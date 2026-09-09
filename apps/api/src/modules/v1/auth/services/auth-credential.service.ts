import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  STRONG_PASSWORD_MESSAGE,
  STRONG_PASSWORD_REGEX,
} from 'src/common/constants/password-policy.constant';
import { UserRole } from 'src/common/enums';
import { AuditAction, AuditSeverity, AuditStatus } from 'src/common/enums/audit-action.enum';
import type { IInvitationResponseDto } from 'src/common/interfaces/iinvitation-response-dto.interface';
import { ProductAnalyticsService } from 'src/common/observability/product-analytics.service';
import { GeoLocationHelper, PasswordService, StringUtility } from 'src/common/utils';
import type { GeoRequestContext } from 'src/common/utils/geo-location.util';
import { Repository } from 'typeorm';
import { AuditLogsService } from '../../audit-logs/services/audit-logs.service';
import { InvitationsService } from '../../invitations/invitations.service';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import type { User } from '../../users/entities/user.entity';
import { buildUserConsentMetadata } from '../../users/interfaces/user-metadata.interface';
import { UserRepository } from '../../users/repositories/users.repository';
import { Account } from '../entities/account.entity';
import { AuthEmailVerificationService } from './auth-email-verification.service';
import { AuthSessionService } from './auth-session.service';

export interface AuthAuditContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthCredentialService {
  private readonly logger = new Logger(AuthCredentialService.name);

  constructor(
    private readonly userRepository: UserRepository,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    private readonly sessionService: AuthSessionService,
    private readonly emailVerificationService: AuthEmailVerificationService,
    private readonly invitationsService: InvitationsService,
    private readonly tenantMembersService: TenantMembersService,
    private readonly auditLogsService: AuditLogsService,
    private readonly productAnalytics: ProductAnalyticsService,
  ) {}

  private async enqueueLoginFailed(
    auditContext: AuthAuditContext | undefined,
    email: string,
    reason: string,
  ) {
    if (!auditContext) return;
    this.productAnalytics.capture(
      auditContext.userId ?? 'anonymous',
      'login_failed',
      { userId: auditContext.userId },
      { reason },
    );
    await this.auditLogsService.queueAuditLog({
      userId: auditContext.userId ?? null,
      ipAddress: auditContext.ipAddress ?? null,
      userAgent: auditContext.userAgent ?? null,
      action: AuditAction.LOGIN_FAILED,
      description: 'Invalid email or password',
      severity: AuditSeverity.MEDIUM,
      status: AuditStatus.FAILED,
      metadata: { reason },
    });
  }

  async validateUser(
    email: string,
    password: string,
    auditContext?: AuthAuditContext,
  ): Promise<User | null> {
    const normalizedEmail = StringUtility.trimAndLowerCase(email);
    const user = await this.userRepository.findUserByEmail(normalizedEmail);
    if (!user) {
      await this.enqueueLoginFailed(auditContext, normalizedEmail, 'invalid_credentials');
      throw new UnauthorizedException('Email or password not correct');
    }
    const account = await this.accountRepository.findOne({
      where: { userId: user.id, providerId: 'credential' },
    });
    const hashedPassword = account?.password ?? user.password;
    if (!hashedPassword || !(await PasswordService.verifyPassword(hashedPassword, password))) {
      await this.enqueueLoginFailed(auditContext, normalizedEmail, 'invalid_credentials');
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
    if (!user.emailVerified)
      throw new UnauthorizedException('Verify your email address before signing in');
    return user;
  }

  async login(
    user: User,
    geo: GeoRequestContext = {},
    auditContext?: AuthAuditContext,
    rememberMe = true,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    if (!user.isActive) throw new UnauthorizedException('User account is inactive');
    if (!user.emailVerified)
      throw new UnauthorizedException('Verify your email address before signing in');
    const ip = GeoLocationHelper.resolveClientIp(geo.headers ?? {}, undefined, geo.ip);
    if (!user.countryCode && !GeoLocationHelper.isLocalhost(ip)) {
      const stored = await GeoLocationHelper.resolveUserCountryCode(geo);
      if (stored) {
        user.countryCode = stored;
        try {
          await this.userRepository.update(user.id, { countryCode: stored });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Failed to update country code for user ${user.id}: ${message}`);
        }
      }
    }
    const session = await this.sessionService.createSession(
      user.id,
      undefined,
      undefined,
      rememberMe,
    );
    const tokens = this.sessionService.generateTokens(user, session.token, rememberMe);
    if (auditContext) {
      await this.auditLogsService.queueAuditLog({
        userId: user.id,
        ipAddress: auditContext.ipAddress ?? ip ?? null,
        userAgent: auditContext.userAgent ?? null,
        action: AuditAction.LOGIN,
        description: 'User logged in successfully',
        severity: AuditSeverity.LOW,
        status: AuditStatus.SUCCESS,
        metadata: { email: user.email, ip, countryCode: user.countryCode },
      });
    }
    this.productAnalytics.capture(user.id, 'login_succeeded', { userId: user.id });
    this.productAnalytics.identify(user.id, { userId: user.id });
    return tokens;
  }

  private async resolveExistingUserOnRegister(user: User, password: string): Promise<User> {
    if (!user.isActive) throw new UnauthorizedException('User account is inactive');
    const credentialAccount = await this.accountRepository.findOne({
      where: { userId: user.id, providerId: 'credential' },
    });
    const hashedPassword = credentialAccount?.password ?? user.password;
    if (hashedPassword) {
      if (!(await PasswordService.verifyPassword(hashedPassword, password)))
        throw new UnauthorizedException('Email or password not correct');
      return user;
    }
    const googleAccount = await this.accountRepository.findOne({
      where: { userId: user.id, providerId: 'google' },
    });
    if (!googleAccount)
      throw new UnprocessableEntityException(
        'This email is already registered. Sign in with your existing method.',
      );
    const newHashedPassword = await PasswordService.hashPassword(password);
    await this.accountRepository.save(
      this.accountRepository.create({
        userId: user.id,
        providerId: 'credential',
        password: newHashedPassword,
      }),
    );
    await this.userRepository.update(user.id, { password: newHashedPassword });
    return user;
  }

  private async processInviteToken(
    user: User,
    inviteToken: string | undefined,
    password: string,
  ): Promise<IInvitationResponseDto | { error: string } | null> {
    if (!inviteToken) return null;
    try {
      const invitationResult = await this.invitationsService.acceptInvitation(
        inviteToken,
        user.email,
        { password },
      );
      const invitation = invitationResult.invitation;
      if (!invitationResult.userExists && invitation) {
        await this.tenantMembersService.createTenantMember(user.id, invitation.tenantId, {
          firstName: invitation.firstName ?? undefined,
          lastName: invitation.lastName ?? undefined,
        });
      }
      return invitation;
    } catch (error) {
      if (error.name === 'NotFoundException')
        return { error: 'Invalid or expired invitation token.' };
      this.logger.error(
        'Error processing invitation during registration',
        error?.stack ? error.stack : error,
      );
      return null;
    }
  }

  private async stampConsentMetadata(user: User): Promise<void> {
    const consentMetadata = buildUserConsentMetadata(true);
    const metadata = { ...(user.metadata ?? {}), ...consentMetadata };
    await this.userRepository.update(user.id, { metadata });
    user.metadata = metadata;
  }

  private trackSignup(userId: string): void {
    this.productAnalytics.capture('anonymous', 'signup_started');
    this.productAnalytics.capture(userId, 'signup_completed', { userId });
  }

  async register(
    email: string,
    password: string,
    geo: GeoRequestContext = {},
    inviteToken?: string,
    termsAccepted?: boolean,
  ): Promise<{ user: User; invitation?: unknown }> {
    try {
      if (termsAccepted !== true)
        throw new BadRequestException('You must accept the terms and privacy policy to register');
      if (!STRONG_PASSWORD_REGEX.test(password))
        throw new BadRequestException(STRONG_PASSWORD_MESSAGE);
      const normalizedEmail = StringUtility.trimAndLowerCase(email);
      const emailExist = await this.userRepository.findUserByEmail(normalizedEmail);
      if (emailExist) {
        if (emailExist.emailVerified)
          throw new UnprocessableEntityException(
            'This email is already registered. Please sign in.',
          );
        const user = await this.resolveExistingUserOnRegister(emailExist, password);
        await this.stampConsentMetadata(user);
        const invitation = await this.processInviteToken(user, inviteToken, password);
        await this.emailVerificationService.sendEmailVerificationOtp(user);
        this.trackSignup(user.id);
        return { user, invitation };
      }
      const [hashedPassword, countryCode] = await Promise.all([
        PasswordService.hashPassword(password),
        GeoLocationHelper.resolveUserCountryCode(geo),
      ]);
      const user = await this.userRepository.insertUser({
        email: normalizedEmail,
        password: hashedPassword,
        role: UserRole.BASIC,
        countryCode,
        emailVerified: false,
        metadata: buildUserConsentMetadata(termsAccepted),
      });
      await this.accountRepository.save(
        this.accountRepository.create({
          userId: user.id,
          providerId: 'credential',
          password: hashedPassword,
        }),
      );
      const invitation = await this.processInviteToken(user, inviteToken, password);
      await this.emailVerificationService.sendEmailVerificationOtp(user);
      this.trackSignup(user.id);
      return { user, invitation };
    } catch (error) {
      this.logger.error('Error during user registration:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof UnprocessableEntityException ||
        error instanceof UnauthorizedException
      )
        throw error;
      throw new UnprocessableEntityException('Registration failed. Please try again.');
    }
  }
}
