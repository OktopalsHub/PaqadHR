import {
  BadRequestException,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  GeoLocationHelper,
  PasswordService,
  StringUtility,
} from 'src/common/utils';
import { UserRole } from 'src/common/enums';
import {
  AuditAction,
  AuditSeverity,
  AuditStatus,
} from '../../../common/enums/audit-action.enum';
import { IInvitationResponseDto } from 'src/common/interfaces/iinvitation-response-dto.interface';

interface AuthAuditContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface AuditQueueEntry {
  context: AuthAuditContext;
  action: AuditAction;
  description: string;
  severity: AuditSeverity;
  status: AuditStatus;
  metadata?: Record<string, unknown>;
}

export class AuditQueueService {
  async enqueue(_entry: AuditQueueEntry): Promise<void> {}
}
import { InvitationsService } from '../invitations/invitations.service';
import { TenantMembersService } from '../tenant-members/tenant-members.service';
import { TenantsService } from '../tenants/tenants.service';
import { UserRepository } from "../users/repositories/users.repository";
import { RefreshTokenRepository } from "../users/repositories/refresh-token.repository";
import { User } from "../users/entities/user.entity";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly invitationsService: InvitationsService,
    private readonly tenantMembersService: TenantMembersService,
    private readonly tenantsService: TenantsService,
    @Optional() private readonly auditQueueService?: AuditQueueService,
  ) {}
  async validateUser(
    email: string,
    password: string,
    auditContext?: AuthAuditContext,
  ): Promise<User | null> {
    const user = await this.userRepository.findUserByEmail(email);
    if (
      !user ||
      !user.password ||
      !(await PasswordService.verifyPassword(user.password, password))
    ) {
      if (auditContext) {
        await this.auditQueueService?.enqueue({
          context: auditContext,
          action: AuditAction.LOGIN_FAILED,
          description: 'Invalid email or password',
          severity: AuditSeverity.MEDIUM,
          status: AuditStatus.FAILED,
          metadata: { email, reason: 'invalid_credentials' },
        });
      }
      throw new UnauthorizedException('Email or password not correct');
    }
    if (!user.isActive) {
      if (auditContext) {
        await this.auditQueueService?.enqueue({
          context: { ...auditContext, userId: user.id },
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
  async generateTokens(user: User) {
    const payload = { email: user.email, sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await this.enforceRefreshTokenLimit(user.id);
    const refreshToken = await this.userRepository.createRefreshToken(
      user,
      expiresAt,
    );
    return { accessToken, refreshToken: refreshToken.token };
  }
  private async enforceRefreshTokenLimit(userId: string): Promise<void> {
    const maxTokens = parseInt(process.env.MAX_REFRESH_TOKENS_PER_USER || '10');
    const activeTokens =
      await this.refreshTokenRepository.findActiveTokenByUserId(userId);
    if (activeTokens.length >= maxTokens) {
      const tokensToRevoke = activeTokens
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .slice(0, activeTokens.length - maxTokens + 1);
      for (const token of tokensToRevoke) {
        await this.refreshTokenRepository.revokeToken(token.id);
      }
      this.logger.warn(
        `Revoked ${tokensToRevoke.length} old refresh tokens for user ${userId} (limit: ${maxTokens})`,
      );
    }
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
    const tokens = await this.generateTokens(user);
    if (auditContext) {
      await this.auditQueueService?.enqueue({
        context: { ...auditContext, userId: user.id },
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
      const user = await this.userRepository.create({
        email: normalizedEmail,
        password: hashedPassword,
        role: UserRole.BASIC,
        countryCode: countryCode ?? '',
      });
      let invitation: IInvitationResponseDto | { error: string } | null = null;
      if (inviteToken) {
        try {
          const invitationResult =
            await this.invitationsService.acceptInvitation(
              inviteToken,
              user.email,
              { password }, 
            );
          invitation = invitationResult.invitation;
          if (!invitationResult.userExists && invitation) {
            await this.tenantMembersService.createTenantMember(
              user.id,
              invitation.tenantId,
              {
                firstName: invitation.firstName,
                lastName: invitation.lastName,
              },
            );
          }
        } catch (error) {
          if (error.name === 'NotFoundException') {
            invitation = { error: 'Invalid or expired invitation token.' };
          } else {
            this.logger.error(
              'Error processing invitation during registration',
              error && error.stack ? error.stack : error,
            );
          }
        }
      }
      if (!inviteToken && subdomain) {
        try {
          const tenant = await this.tenantsService.getTenantBySlug(subdomain);
          if (tenant) {
            await this.tenantMembersService.createTenantMember(
              user.id,
              tenant.id,
              { firstName: '', lastName: '' }, 
            );
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
      throw new UnprocessableEntityException(
        'Registration failed. Please try again.',
      );
    }
  }
  async findOrCreateGoogleUser(
    googleId: string,
    email: string,
    ip?: string,
  ): Promise<User> {
    const normalizedEmail = StringUtility.trimAndLowerCase(email);
    let user = await this.userRepository.findUserByGoogleId(googleId);
    if (!user) {
      const [existingUser, countryCode] = await Promise.all([
        this.userRepository.findUserByEmail(normalizedEmail),
        GeoLocationHelper.getCountryCode(ip ?? ''),
      ]);
      if (existingUser) {
        throw new UnauthorizedException(
          'Email already exists with another account',
        );
      }
      user = await this.userRepository.create({
        email: normalizedEmail,
        googleId,
        role: UserRole.BASIC,
        countryCode: countryCode ?? 'UNKNOWN',
      });
    }
    return user;
  }
  async refreshToken(refreshToken: string) {
    const token = await this.userRepository.findRefreshToken(refreshToken);
    if (!token || token.isRevoked || token.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    const user = token.user;
    await this.userRepository.revokeRefreshToken(refreshToken); 
    return this.generateTokens(user);
  }
  async storeRefreshToken(
    token: string,
    userId: string,
    ttlSeconds: number,
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + ttlSeconds);
    await this.refreshTokenRepository.create({
      token,
      userId,
      expiresAt,
      isRevoked: false,
    });
  }
  async revokeRefreshToken(token: string): Promise<void> {
    await this.refreshTokenRepository.revokeToken(token);
  }
  async revokeAllRefreshTokensForUser(userId: string): Promise<void> {
    await this.refreshTokenRepository.revokeAllUserTokens(userId);
  }
  async logout(refreshToken: string) {
    await this.userRepository.revokeRefreshToken(refreshToken);
  }
  async getActiveRefreshTokensForUser(userId: string) {
    return this.refreshTokenRepository.findActiveTokenByUserId(userId);
  }
  async validateRefreshToken(refreshToken: string) {
    const token = await this.userRepository.findRefreshToken(refreshToken);
    if (!token || token.isRevoked || token.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    return token;
  }
}
