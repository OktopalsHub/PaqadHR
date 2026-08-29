import { randomInt, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { ENVIRONMENT } from 'src/common/config/env.config';
import { getPrivacyPolicyVersion } from 'src/common/config/privacy.config';
import {
  STRONG_PASSWORD_MESSAGE,
  STRONG_PASSWORD_REGEX,
} from 'src/common/constants/password-policy.constant';
import { UserRole } from 'src/common/enums';
import { AuditAction, AuditSeverity, AuditStatus } from 'src/common/enums/audit-action.enum';
import type { IInvitationResponseDto } from 'src/common/interfaces/iinvitation-response-dto.interface';
import { ProductAnalyticsService } from 'src/common/observability/product-analytics.service';
import { RateLimitService } from 'src/common/services/rate-limit.service';
import { GeoLocationHelper, PasswordService, StringUtility, sha256Hex } from 'src/common/utils';
import type { GeoRequestContext } from 'src/common/utils/geo-location.util';
import { Repository } from 'typeorm';
import { AuditLogsService } from '../audit-logs/services/audit-logs.service';
import { InvitationsService } from '../invitations/invitations.service';
import { ZeptomailEmailService } from '../notifications/services/zeptomail-email.service';
import { TenantMembersService } from '../tenant-members/tenant-members.service';
import type { User } from '../users/entities/user.entity';
import { buildUserConsentMetadata } from '../users/interfaces/user-metadata.interface';
import { UserRepository } from '../users/repositories/users.repository';
import type { OtpPurpose } from './dto/otp.dto';
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
  private readonly maxOtpFailedAttempts = 5;
  private readonly otpLockDurationMinutes = 30;

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
    private readonly auditLogsService: AuditLogsService,
    private readonly rateLimitService: RateLimitService,
    private readonly zeptomailEmailService: ZeptomailEmailService,
    private readonly productAnalytics: ProductAnalyticsService,
  ) {}

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
    if (!user.emailVerified) {
      throw new UnauthorizedException('Verify your email address before signing in');
    }
    return user;
  }

  private async enqueueLoginFailed(
    auditContext: AuthAuditContext | undefined,
    email: string,
    reason: string,
  ) {
    if (!auditContext) return;
    this.productAnalytics.capture(
      auditContext.userId ?? 'anonymous',
      'login_failed',
      {
        userId: auditContext.userId,
      },
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

  generateTokens(user: User, sessionToken?: string, rememberMe = false) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      sid: sessionToken,
    };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: ENVIRONMENT.JWT.ACCESS_EXPIRES_IN as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });
    const refreshTokenExpiry = rememberMe ? '30d' : '24h';
    const refreshToken = this.jwtService.sign(payload, {
      secret: ENVIRONMENT.JWT.REFRESH_SECRET,
      expiresIn: refreshTokenExpiry,
    });
    return { accessToken, refreshToken };
  }

  private async createSession(
    userId: string,
    ipAddress?: string | null,
    userAgent?: string | null,
    rememberMe = false,
  ): Promise<Session> {
    const sessionToken = randomUUID();
    const durationMs = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + durationMs);
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
    geo: GeoRequestContext = {},
    auditContext?: AuthAuditContext,
    rememberMe = false,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }
    if (!user.emailVerified) {
      throw new UnauthorizedException('Verify your email address before signing in');
    }
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

    const session = await this.createSession(user.id, undefined, undefined, rememberMe);
    const tokens = this.generateTokens(user, session.token, rememberMe);

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
    this.productAnalytics.capture(user.id, 'login_succeeded', { userId: user.id });
    this.productAnalytics.identify(user.id, { userId: user.id });
    return tokens;
  }

  private async resolveExistingUserOnRegister(user: User, password: string): Promise<User> {
    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    const credentialAccount = await this.accountRepository.findOne({
      where: { userId: user.id, providerId: 'credential' },
    });
    const hashedPassword = credentialAccount?.password ?? user.password;

    if (hashedPassword) {
      if (!(await PasswordService.verifyPassword(hashedPassword, password))) {
        throw new UnauthorizedException('Email or password not correct');
      }
      return user;
    }

    const googleAccount = await this.accountRepository.findOne({
      where: { userId: user.id, providerId: 'google' },
    });
    if (!googleAccount) {
      throw new UnprocessableEntityException(
        'This email is already registered. Sign in with your existing method.',
      );
    }

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

  async register(
    email: string,
    password: string,
    geo: GeoRequestContext = {},
    inviteToken?: string,
    termsAccepted?: boolean,
  ): Promise<{ user: User; invitation?: unknown }> {
    try {
      if (termsAccepted !== true) {
        throw new BadRequestException('You must accept the terms and privacy policy to register');
      }
      if (!STRONG_PASSWORD_REGEX.test(password)) {
        throw new BadRequestException(STRONG_PASSWORD_MESSAGE);
      }
      const normalizedEmail = StringUtility.trimAndLowerCase(email);
      const emailExist = await this.userRepository.findUserByEmail(normalizedEmail);
      if (emailExist) {
        if (emailExist.emailVerified) {
          throw new UnprocessableEntityException(
            'This email is already registered. Please sign in.',
          );
        }
        const user = await this.resolveExistingUserOnRegister(emailExist, password);
        const consentMetadata = buildUserConsentMetadata(true);
        await this.userRepository.update(user.id, {
          metadata: { ...(user.metadata ?? {}), ...consentMetadata },
        });
        user.metadata = { ...(user.metadata ?? {}), ...consentMetadata };
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
                firstName: invitation.firstName ?? undefined,
                lastName: invitation.lastName ?? undefined,
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
        await this.sendEmailVerificationOtp(user);
        this.productAnalytics.capture('anonymous', 'signup_started');
        this.productAnalytics.capture(user.id, 'signup_completed', { userId: user.id });
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
              firstName: invitation.firstName ?? undefined,
              lastName: invitation.lastName ?? undefined,
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
      await this.sendEmailVerificationOtp(user);
      this.productAnalytics.capture('anonymous', 'signup_started');
      this.productAnalytics.capture(user.id, 'signup_completed', { userId: user.id });
      return { user, invitation };
    } catch (error) {
      this.logger.error('Error during user registration:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof UnprocessableEntityException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new UnprocessableEntityException('Registration failed. Please try again.');
    }
  }

  private emailVerificationIdentifier(userId: string): string {
    return `email-verification:${userId}`;
  }

  async sendEmailVerificationOtp(user: User): Promise<void> {
    const rate = await this.rateLimitService.checkRateLimit(`email-verification:send:${user.id}`, {
      rules: [{ windowMs: 15 * 60 * 1000, maxRequests: 3 }],
    });
    if (!rate.allowed) {
      throw new BadRequestException(
        `Too many verification code requests. Try again in ${rate.retryAfter ?? 60}s`,
      );
    }

    const code = String(randomInt(100000, 999999));
    const identifier = this.emailVerificationIdentifier(user.id);
    const hashedCode = await PasswordService.hashPassword(code);
    await this.verificationRepository.delete({ identifier });
    await this.verificationRepository.save(
      this.verificationRepository.create({
        identifier,
        token: hashedCode,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      }),
    );
    try {
      await this.zeptomailEmailService.sendTemplateEmail(user.email, 'otp-verification', {
        code,
        purposeLabel: 'verifying your email address',
      });
    } catch (error) {
      // The account and one-time code are already persisted. Keep registration
      // successful so the user can request a replacement code after an email
      // provider outage.
      this.logger.error(
        'Failed to send email verification code',
        error instanceof Error ? error.name : 'Unknown email provider error',
      );
    }
  }

  async resendEmailVerification(email: string, ip?: string): Promise<{ message: string }> {
    if (ip) {
      const ipRate = await this.rateLimitService.checkRateLimit(
        `email-verification:resend-ip:${ip}`,
        {
          rules: [{ windowMs: 15 * 60 * 1000, maxRequests: 10 }],
        },
      );
      if (!ipRate.allowed) {
        throw new BadRequestException('Too many verification requests. Please try again later.');
      }
    }

    const user = await this.userRepository.findUserByEmail(StringUtility.trimAndLowerCase(email));
    if (user && !user.emailVerified) {
      await this.sendEmailVerificationOtp(user);
    }
    return { message: 'If this account needs verification, a code was sent.' };
  }

  async verifyEmail(email: string, code: string): Promise<User> {
    const user = await this.userRepository.findUserByEmail(StringUtility.trimAndLowerCase(email));
    if (!user || user.emailVerified) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }

    const lockKey = `email-verification:${user.id}`;
    const lock = await this.rateLimitService.getLockout(lockKey);
    if (this.rateLimitService.isLocked(lock)) {
      throw new UnauthorizedException('Too many failed attempts. Try again later.');
    }

    const verification = await this.verificationRepository.findOne({
      where: { identifier: this.emailVerificationIdentifier(user.id) },
    });
    const codeValid =
      verification &&
      verification.expiresAt >= new Date() &&
      (await PasswordService.verifyPassword(verification.token, code));
    if (!codeValid) {
      await this.rateLimitService.recordLockoutFailure(
        lockKey,
        this.maxOtpFailedAttempts,
        this.otpLockDurationMinutes * 60 * 1000,
      );
      throw new UnauthorizedException('Invalid or expired verification code');
    }

    await this.userRepository.update(user.id, { emailVerified: true });
    user.emailVerified = true;
    await this.verificationRepository.delete(verification.id);
    await this.rateLimitService.clearLockout(lockKey);
    this.productAnalytics.capture(user.id, 'email_verified', { userId: user.id });
    this.productAnalytics.identify(user.id, { userId: user.id });
    return user;
  }

  async findOrCreateGoogleUser(
    googleId: string,
    email: string,
    geo: GeoRequestContext = {},
    termsAccepted = false,
    acceptedPolicyVersion?: string,
  ): Promise<User> {
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
      if (!existingUser.isActive) {
        throw new UnauthorizedException('User account is inactive');
      }

      const linkedGoogle = await this.accountRepository.findOne({
        where: { userId: existingUser.id, providerId: 'google' },
      });
      if (linkedGoogle) {
        if (linkedGoogle.accountId !== googleId) {
          linkedGoogle.accountId = googleId;
          await this.accountRepository.save(linkedGoogle);
        }
        if (!existingUser.emailVerified) {
          await this.userRepository.update(existingUser.id, { emailVerified: true });
          existingUser.emailVerified = true;
        }
        return existingUser;
      }

      await this.accountRepository.save(
        this.accountRepository.create({
          userId: existingUser.id,
          providerId: 'google',
          accountId: googleId,
        }),
      );

      if (!existingUser.emailVerified) {
        await this.userRepository.update(existingUser.id, { emailVerified: true });
        existingUser.emailVerified = true;
      }

      return existingUser;
    }

    if (termsAccepted !== true) {
      throw new BadRequestException('You must accept the terms and privacy policy to continue');
    }

    const currentVersion = getPrivacyPolicyVersion();
    if (!acceptedPolicyVersion || acceptedPolicyVersion !== currentVersion) {
      throw new BadRequestException(
        'The privacy policy was updated. Please accept the current policy and try again.',
      );
    }

    const countryCode = await GeoLocationHelper.resolveUserCountryCode(geo);
    const user = await this.userRepository.insertUser({
      email: normalizedEmail,
      role: UserRole.BASIC,
      countryCode,
      emailVerified: true,
      metadata: buildUserConsentMetadata(true),
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
    let payload: { sub: string; sid?: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: ENVIRONMENT.JWT.REFRESH_SECRET,
      }) as { sub: string; sid?: string };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.userRepository.findUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (!user.emailVerified) {
      await this.sessionRepository.delete({ userId: user.id });
      throw new UnauthorizedException('Verify your email address before signing in');
    }

    if (!payload.sid) {
      return { ...this.generateTokens(user, payload.sid), rememberMe: false };
    }

    const session = await this.sessionRepository.findOne({
      where: { token: payload.sid, userId: user.id },
    });

    if (!session) {
      await this.sessionRepository.delete({ userId: user.id });
      throw new UnauthorizedException('Invalid or expired session');
    }

    if (session.expiresAt < new Date()) {
      await this.sessionRepository.delete({ token: payload.sid });
      throw new UnauthorizedException('Invalid or expired session');
    }

    const newSessionToken = randomUUID();
    session.token = newSessionToken;
    const sessionDurationMs = session.expiresAt.getTime() - session.createdAt.getTime();
    const isLongSession = sessionDurationMs > 2 * 24 * 60 * 60 * 1000;
    const newDurationMs = isLongSession ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    session.expiresAt = new Date(Date.now() + newDurationMs);
    await this.sessionRepository.save(session);

    return {
      ...this.generateTokens(user, newSessionToken, isLongSession),
      rememberMe: isLongSession,
    };
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

  async forgotPassword(email: string, ip?: string) {
    const normalizedEmail = StringUtility.trimAndLowerCase(email);
    if (ip) {
      const ipRate = await this.rateLimitService.checkRateLimit(`forgot-password-ip:${ip}`, {
        rules: [{ windowMs: 15 * 60 * 1000, maxRequests: 5 }],
      });
      if (!ipRate.allowed) {
        throw new BadRequestException('Too many requests from this IP. Please try again later.');
      }
    }
    const rate = await this.rateLimitService.checkRateLimit(`forgot-password:${normalizedEmail}`, {
      rules: [{ windowMs: 15 * 60 * 1000, maxRequests: 3 }],
    });
    if (!rate.allowed) {
      throw new BadRequestException(
        `Too many reset requests. Try again in ${rate.retryAfter ?? 60}s`,
      );
    }

    const user = await this.userRepository.findUserByEmail(normalizedEmail);
    if (!user) {
      return { message: 'If email exists, a reset link was sent' };
    }

    const resetToken = randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.verificationRepository.delete({ identifier: `reset:${user.id}` });
    await this.verificationRepository.save(
      this.verificationRepository.create({
        identifier: `reset:${user.id}`,
        token: sha256Hex(resetToken),
        expiresAt,
      }),
    );

    const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const resetLink = `${frontendBase}/reset-password?token=${encodeURIComponent(resetToken)}`;
    try {
      await this.zeptomailEmailService.sendTemplateEmail(normalizedEmail, 'password-reset', {
        resetLink,
      });
    } catch (error) {
      this.logger.error('Failed to send password reset email', error);
    }

    return { message: 'If email exists, a reset link was sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    if (!STRONG_PASSWORD_REGEX.test(newPassword)) {
      throw new BadRequestException(STRONG_PASSWORD_MESSAGE);
    }
    const verification = await this.verificationRepository.findOne({
      where: { token: sha256Hex(token) },
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

  async hasCredentialAccount(userId: string): Promise<boolean> {
    const account = await this.accountRepository.findOne({
      where: { userId, providerId: 'credential' },
    });
    return Boolean(account?.password);
  }

  private otpPurposeLabel(purpose: OtpPurpose): string {
    return purpose === 'password_change' ? 'changing your password' : 'updating payment details';
  }

  private otpIdentifier(userId: string, purpose: OtpPurpose): string {
    return `otp:${purpose}:${userId}`;
  }

  async sendOtp(userId: string, email: string, purpose: OtpPurpose) {
    const rate = await this.rateLimitService.checkRateLimit(`otp:send:${userId}:${purpose}`, {
      rules: [{ windowMs: 15 * 60 * 1000, maxRequests: 3 }],
    });
    if (!rate.allowed) {
      throw new BadRequestException(
        `Too many code requests. Try again in ${rate.retryAfter ?? 60}s`,
      );
    }

    const lockKey = `${userId}:${purpose}`;
    const lock = await this.rateLimitService.getLockout(lockKey);
    if (this.rateLimitService.isLocked(lock)) {
      throw new UnauthorizedException('Too many failed attempts. Try again later.');
    }

    const code = String(randomInt(100000, 999999));
    const identifier = this.otpIdentifier(userId, purpose);
    const hashedCode = await PasswordService.hashPassword(code);
    await this.verificationRepository.delete({ identifier });
    await this.verificationRepository.save(
      this.verificationRepository.create({
        identifier,
        token: hashedCode,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      }),
    );

    await this.zeptomailEmailService.sendTemplateEmail(email, 'otp-verification', {
      code,
      purposeLabel: this.otpPurposeLabel(purpose),
    });

    return { message: 'Verification code sent' };
  }

  async verifyOtp(userId: string, purpose: OtpPurpose, code: string) {
    const lockKey = `${userId}:${purpose}`;
    const lock = await this.rateLimitService.getLockout(lockKey);
    if (this.rateLimitService.isLocked(lock)) {
      throw new UnauthorizedException('Too many failed attempts. Try again later.');
    }

    const identifier = this.otpIdentifier(userId, purpose);
    const verification = await this.verificationRepository.findOne({
      where: { identifier },
    });
    const codeValid =
      verification &&
      verification.expiresAt >= new Date() &&
      (await PasswordService.verifyPassword(verification.token, code));
    if (!codeValid) {
      await this.rateLimitService.recordLockoutFailure(
        lockKey,
        this.maxOtpFailedAttempts,
        this.otpLockDurationMinutes * 60 * 1000,
      );
      throw new BadRequestException('Invalid or expired verification code');
    }

    await this.verificationRepository.delete(verification.id);
    await this.rateLimitService.clearLockout(lockKey);

    const otpProof = this.jwtService.sign(
      { sub: userId, purpose, type: 'otp_proof' },
      { expiresIn: '5m' },
    );
    return { otpProof };
  }

  assertOtpProof(otpProof: string, userId: string, purpose: OtpPurpose): void {
    try {
      const payload = this.jwtService.verify<{
        sub: string;
        purpose: OtpPurpose;
        type: string;
      }>(otpProof);
      if (payload.type !== 'otp_proof' || payload.sub !== userId || payload.purpose !== purpose) {
        throw new UnauthorizedException('Invalid verification');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired verification');
    }
  }

  async changePassword(userId: string, otpProof: string, newPassword: string) {
    if (!STRONG_PASSWORD_REGEX.test(newPassword)) {
      throw new BadRequestException(STRONG_PASSWORD_MESSAGE);
    }
    this.assertOtpProof(otpProof, userId, 'password_change');

    const account = await this.accountRepository.findOne({
      where: { userId, providerId: 'credential' },
    });
    if (!account) {
      throw new BadRequestException(
        'No password account found. Sign in with Google or contact support.',
      );
    }

    const hashedPassword = await PasswordService.hashPassword(newPassword);
    account.password = hashedPassword;
    await this.accountRepository.save(account);

    const user = await this.userRepository.findUser(userId);
    if (user) {
      user.password = hashedPassword;
      await this.userRepository.save(user);
    }

    await this.sessionRepository.delete({ userId });

    return { message: 'Password changed successfully' };
  }
}
