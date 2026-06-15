import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { ENVIRONMENT } from 'src/common/config/env.config';
import { UserRole } from 'src/common/enums';
import { AuditAction, AuditSeverity, AuditStatus } from 'src/common/enums/audit-action.enum';
import type { IInvitationResponseDto } from 'src/common/interfaces/iinvitation-response-dto.interface';
import { GeoLocationHelper, PasswordService, StringUtility } from 'src/common/utils';
import type { Repository } from 'typeorm';
import type { AuditLogsService } from '../../../common/services/audit-logs.service';
import type { InvitationsService } from '../invitations/invitations.service';
import type { TenantMembersService } from '../tenant-members/tenant-members.service';
import type { TenantsService } from '../tenants/tenants.service';
import type { User } from '../users/entities/user.entity';
import type { UserRepository } from '../users/repositories/users.repository';
import { Account } from './entities/account.entity';
import { Session } from './entities/session.entity';
import { Verification } from './entities/verification.entity';

interface AuthAuditContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userRepository: UserRepository,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    @InjectRepository(Verification)
    private readonly verificationRepository: Repository<Verification>,
    private readonly jwtService: JwtService,
    private readonly invitationsService: InvitationsService,
    private readonly tenantMembersService: TenantMembersService,
    private readonly tenantsService: TenantsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async validateUser(
    email: string,
    password: string,
    auditContext?: AuthAuditContext,
  ): Promise<User | null> {
    const user = await this.userRepository.findUserByEmail(email);
    if (!user) {
      await this.enqueueLoginFailed(auditContext, email, 'invalid_credentials');
      throw new UnauthorizedException('Email or password not correct');
    }

    const account = await this.accountRepository.findOne({
      where: { userId: user.id, providerId: 'credential' },
    });
    const hashedPassword = account?.password ?? user.password;

    if (!hashedPassword || !(await PasswordService.verifyPassword(hashedPassword, password))) {
      await this.enqueueLoginFailed(auditContext, email, 'invalid_credentials');
      throw new UnauthorizedException('Email or password not correct');
    }

    if (!user.isActive) {
      if (auditContext) {
        await this.auditLogsService.queueAuditLog({
          userId: auditContext.userId ?? user.id,
          ipAddress: auditContext.ipAddress ?? null,
          userAgent: auditContext.userAgent ?? null,
          action: AuditAction.LOGIN_FAILED,
          description: 'Login attempt with inactive account',
          severity: AuditSeverity.HIGH,
          status: AuditStatus.FAILED,
          metadata: { email, reason: 'account_inactive' },
        });
      }
      throw new UnauthorizedException('User account is inactive');
    }
    return user;
  }

  private async enqueueLoginFailed(
    auditContext: AuthAuditContext | undefined,
    email: string,
    reason: string,
  ) {
    if (!auditContext) return;
    await this.auditLogsService.queueAuditLog({
      userId: auditContext.userId ?? null,
      ipAddress: auditContext.ipAddress ?? null,
      userAgent: auditContext.userAgent ?? null,
      action: AuditAction.LOGIN_FAILED,
      description: 'Invalid email or password',
      severity: AuditSeverity.MEDIUM,
      status: AuditStatus.FAILED,
      metadata: { email, reason },
    });
  }

  generateTokens(user: User, sessionToken?: string) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: sessionToken,
    };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: ENVIRONMENT.JWT.ACCESS_EXPIRES_IN as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: ENVIRONMENT.JWT.REFRESH_SECRET,
      expiresIn: '7d',
    });
    return { accessToken, refreshToken };
  }

  private async createSession(
    userId: string,
    ipAddress?: string | null,
    userAgent?: string | null,
  ): Promise<Session> {
    const sessionToken = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const session = this.sessionRepository.create({
      userId,
      token: sessionToken,
      expiresAt,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    });
    return this.sessionRepository.save(session);
  }

  async login(
    user: User,
    ip: string,
    auditContext?: AuthAuditContext,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }
    if (!user.countryCode && !GeoLocationHelper.isLocalhost(ip)) {
      const countryCode = await GeoLocationHelper.getCountryCode(ip);
      if (!countryCode) {
        throw new BadRequestException('Unable to determine country code');
      }
      user.countryCode = countryCode;
      await this.userRepository.update(user.id, { countryCode });
    }

    const session = await this.createSession(user.id);
    const tokens = this.generateTokens(user, session.token);

    if (auditContext) {
      await this.auditLogsService.queueAuditLog({
        userId: user.id,
        ipAddress: auditContext.ipAddress ?? ip ?? null,
        userAgent: auditContext.userAgent ?? null,
        action: AuditAction.LOGIN,
        description: 'User logged in successfully',
        severity: AuditSeverity.LOW,
        status: AuditStatus.SUCCESS,
        metadata: {
          email: user.email,
          ip,
          countryCode: user.countryCode,
        },
      });
    }
    return tokens;
  }

  async register(
    email: string,
    password: string,
    ip: string,
    inviteToken?: string,
    subdomain?: string,
  ): Promise<{ user: User; invitation?: unknown }> {
    try {
      const normalizedEmail = StringUtility.trimAndLowerCase(email);
      const [hashedPassword, countryCode, emailExist] = await Promise.all([
        PasswordService.hashPassword(password),
        GeoLocationHelper.getCountryCode(ip || ''),
        this.userRepository.findUserByEmail(normalizedEmail),
      ]);
      if (emailExist) {
        throw new UnprocessableEntityException('Email already exists');
      }

      const user = await this.userRepository.insertUser({
        email: normalizedEmail,
        password: hashedPassword,
        role: UserRole.BASIC,
        countryCode: GeoLocationHelper.toStoredCountryCode(countryCode),
        emailVerified: false,
      });

      await this.accountRepository.save(
        this.accountRepository.create({
          userId: user.id,
          providerId: 'credential',
          password: hashedPassword,
        }),
      );

      let invitation: IInvitationResponseDto | { error: string } | null = null;
      if (inviteToken) {
        try {
          const invitationResult = await this.invitationsService.acceptInvitation(
            inviteToken,
            user.email,
            { password },
          );
          invitation = invitationResult.invitation;
          if (!invitationResult.userExists && invitation) {
            await this.tenantMembersService.createTenantMember(user.id, invitation.tenantId, {
              firstName: invitation.firstName,
              lastName: invitation.lastName,
            });
          }
        } catch (error) {
          if (error.name === 'NotFoundException') {
            invitation = { error: 'Invalid or expired invitation token.' };
          } else {
            this.logger.error(
              'Error processing invitation during registration',
              error?.stack ? error.stack : error,
            );
          }
        }
      }
      if (!inviteToken && subdomain) {
        try {
          const tenant = await this.tenantsService.getTenantBySlug(subdomain);
          if (tenant) {
            await this.tenantMembersService.createTenantMember(user.id, tenant.id, {
              firstName: '',
              lastName: '',
            });
          }
        } catch (error) {
          this.logger.error('Error adding user to tenant by subdomain:', error);
        }
      }
      return { user, invitation };
    } catch (error) {
      this.logger.error('Error during user registration:', error);
      if (error instanceof UnprocessableEntityException) {
        throw error;
      }
      throw new UnprocessableEntityException('Registration failed. Please try again.');
    }
  }

  async findOrCreateGoogleUser(googleId: string, email: string, ip?: string): Promise<User> {
    const normalizedEmail = StringUtility.trimAndLowerCase(email);

    const existingAccount = await this.accountRepository.findOne({
      where: { providerId: 'google', accountId: googleId },
      relations: ['user'],
    });
    if (existingAccount?.user) {
      return existingAccount.user;
    }

    const existingUser = await this.userRepository.findUserByEmail(normalizedEmail);
    if (existingUser) {
      throw new UnauthorizedException('Email already exists with another account');
    }

    const countryCode = await GeoLocationHelper.getCountryCode(ip ?? '');
    const user = await this.userRepository.insertUser({
      email: normalizedEmail,
      role: UserRole.BASIC,
      countryCode: countryCode ?? 'UNKNOWN',
      emailVerified: true,
    });

    await this.accountRepository.save(
      this.accountRepository.create({
        userId: user.id,
        providerId: 'google',
        accountId: googleId,
      }),
    );

    return user;
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: ENVIRONMENT.JWT.REFRESH_SECRET,
      }) as { sub: string; sid?: string };

      const user = await this.userRepository.findUser(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (payload.sid) {
        const session = await this.sessionRepository.findOne({
          where: { token: payload.sid, userId: user.id },
        });
        if (!session || session.expiresAt < new Date()) {
          throw new UnauthorizedException('Invalid or expired session');
        }
      }

      return this.generateTokens(user, payload.sid);
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(userId: string) {
    await this.sessionRepository.delete({ userId });
  }

  async logoutByRefreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: ENVIRONMENT.JWT.REFRESH_SECRET,
      }) as { sub: string; sid?: string };
      if (payload.sid) {
        await this.sessionRepository.delete({
          userId: payload.sub,
          token: payload.sid,
        });
      } else {
        await this.sessionRepository.delete({ userId: payload.sub });
      }
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getActiveSessionsForUser(userId: string) {
    return this.sessionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async forgotPassword(email: string) {
    const user = await this.userRepository.findUserByEmail(email);
    if (!user) {
      return { message: 'If email exists, a reset token was created' };
    }

    const resetToken = randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.verificationRepository.save(
      this.verificationRepository.create({
        identifier: `reset:${user.id}`,
        token: resetToken,
        expiresAt,
      }),
    );

    return {
      message: 'If email exists, a reset token was created',
      resetToken,
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const verification = await this.verificationRepository.findOne({
      where: { token },
    });

    if (!verification || verification.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const userId = verification.identifier.replace('reset:', '');
    const user = await this.userRepository.findUser(userId);
    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await PasswordService.hashPassword(newPassword);
    user.password = hashedPassword;
    await this.userRepository.save(user);

    const account = await this.accountRepository.findOne({
      where: { userId: user.id, providerId: 'credential' },
    });
    if (account) {
      account.password = hashedPassword;
      await this.accountRepository.save(account);
    }

    await this.verificationRepository.delete(verification.id);
    return { message: 'Password reset successfully' };
  }
}
