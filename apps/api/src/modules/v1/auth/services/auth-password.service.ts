import { randomInt, randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import {
  STRONG_PASSWORD_MESSAGE,
  STRONG_PASSWORD_REGEX,
} from 'src/common/constants/password-policy.constant';
import { RateLimitService } from 'src/common/services/rate-limit.service';
import { PasswordService, StringUtility, sha256Hex } from 'src/common/utils';
import { Repository } from 'typeorm';
import { ZeptomailEmailService } from '../../notifications/services/zeptomail-email.service';
import { UserRepository } from '../../users/repositories/users.repository';
import type { OtpPurpose } from '../dto/otp.dto';
import { Account } from '../entities/account.entity';
import { Session } from '../entities/session.entity';
import { Verification } from '../entities/verification.entity';

@Injectable()
export class AuthPasswordService {
  private readonly logger = new Logger(AuthPasswordService.name);
  private readonly maxOtpFailedAttempts = 5;
  private readonly otpLockDurationMinutes = 30;

  constructor(
    private readonly userRepository: UserRepository,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(Verification)
    private readonly verificationRepository: Repository<Verification>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    private readonly jwtService: JwtService,
    private readonly rateLimitService: RateLimitService,
    private readonly zeptomailEmailService: ZeptomailEmailService,
  ) {}

  private otpPurposeLabel(purpose: OtpPurpose): string {
    return purpose === 'password_change' ? 'changing your password' : 'updating payment details';
  }

  private otpIdentifier(userId: string, purpose: OtpPurpose): string {
    return `otp:${purpose}:${userId}`;
  }

  async forgotPassword(email: string, ip?: string) {
    const normalizedEmail = StringUtility.trimAndLowerCase(email);
    if (ip) {
      const ipRate = await this.rateLimitService.checkRateLimit(`forgot-password-ip:${ip}`, {
        rules: [{ windowMs: 15 * 60 * 1000, maxRequests: 5 }],
      });
      if (!ipRate.allowed)
        throw new BadRequestException('Too many requests from this IP. Please try again later.');
    }
    const rate = await this.rateLimitService.checkRateLimit(`forgot-password:${normalizedEmail}`, {
      rules: [{ windowMs: 15 * 60 * 1000, maxRequests: 3 }],
    });
    if (!rate.allowed)
      throw new BadRequestException(
        `Too many reset requests. Try again in ${rate.retryAfter ?? 60}s`,
      );
    const user = await this.userRepository.findUserByEmail(normalizedEmail);
    if (!user) return { message: 'If email exists, a reset link was sent' };
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
    // The response stays generic on purpose so it cannot be used to enumerate
    // registered emails, but a delivery failure must still be visible in the logs.
    await this.trySendTemplateEmail(
      normalizedEmail,
      'password-reset',
      { resetLink },
      'password reset email',
    );

    return { message: 'If email exists, a reset link was sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    if (!STRONG_PASSWORD_REGEX.test(newPassword))
      throw new BadRequestException(STRONG_PASSWORD_MESSAGE);
    const verification = await this.verificationRepository.findOne({
      where: { token: sha256Hex(token) },
    });
    if (!verification || verification.expiresAt < new Date())
      throw new BadRequestException('Invalid or expired reset token');
    const userId = verification.identifier.replace('reset:', '');
    const user = await this.userRepository.findUser(userId);
    if (!user) throw new BadRequestException('Invalid or expired reset token');
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

  async sendOtp(userId: string, email: string, purpose: OtpPurpose) {
    const rate = await this.rateLimitService.checkRateLimit(`otp:send:${userId}:${purpose}`, {
      rules: [{ windowMs: 15 * 60 * 1000, maxRequests: 3 }],
    });
    if (!rate.allowed)
      throw new BadRequestException(
        `Too many code requests. Try again in ${rate.retryAfter ?? 60}s`,
      );
    const lockKey = `${userId}:${purpose}`;
    const lock = await this.rateLimitService.getLockout(lockKey);
    if (this.rateLimitService.isLocked(lock))
      throw new UnauthorizedException('Too many failed attempts. Try again later.');
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
    const otpSent = await this.trySendTemplateEmail(
      email,
      'otp-verification',
      {
        code,
        purposeLabel: this.otpPurposeLabel(purpose),
      },
      'OTP email',
    );
    if (!otpSent) {
      // The caller asked for a code and will not receive one, so say so instead of
      // returning success for an email that will never arrive.
      throw new BadRequestException(
        'Could not send the verification code. Please try again in a moment.',
      );
    }
    return { message: 'Verification code sent' };
  }

  /**
   * sendTemplateEmail reports provider failure in its result rather than throwing, so
   * callers that only await it see nothing wrong. This normalises both shapes — a
   * failed result and an unexpected throw — into a boolean, and logs either one.
   */
  private async trySendTemplateEmail(
    to: string,
    templateKey: string,
    variables: Record<string, unknown>,
    label: string,
  ): Promise<boolean> {
    try {
      const result = await this.zeptomailEmailService.sendTemplateEmail(to, templateKey, variables);
      if (!result?.success) {
        this.logger.error(`Failed to send ${label}: ${result?.error ?? 'unknown error'}`);
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send ${label}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  async verifyOtp(userId: string, purpose: OtpPurpose, code: string) {
    const lockKey = `${userId}:${purpose}`;
    const lock = await this.rateLimitService.getLockout(lockKey);
    if (this.rateLimitService.isLocked(lock))
      throw new UnauthorizedException('Too many failed attempts. Try again later.');
    const identifier = this.otpIdentifier(userId, purpose);
    const verification = await this.verificationRepository.findOne({ where: { identifier } });
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
      const payload = this.jwtService.verify<{ sub: string; purpose: OtpPurpose; type: string }>(
        otpProof,
      );
      if (payload.type !== 'otp_proof' || payload.sub !== userId || payload.purpose !== purpose)
        throw new UnauthorizedException('Invalid verification');
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired verification');
    }
  }

  async changePassword(userId: string, otpProof: string, newPassword: string) {
    if (!STRONG_PASSWORD_REGEX.test(newPassword))
      throw new BadRequestException(STRONG_PASSWORD_MESSAGE);
    this.assertOtpProof(otpProof, userId, 'password_change');
    const account = await this.accountRepository.findOne({
      where: { userId, providerId: 'credential' },
    });
    if (!account)
      throw new BadRequestException(
        'No password account found. Sign in with Google or contact support.',
      );
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
