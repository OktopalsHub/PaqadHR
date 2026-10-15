import { randomInt } from 'node:crypto';
import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ProductAnalyticsService } from 'src/common/observability/product-analytics.service';
import { RateLimitService } from 'src/common/services/rate-limit.service';
import { PasswordService, StringUtility } from 'src/common/utils';
import { Repository } from 'typeorm';
import { ZeptomailEmailService } from '../../notifications/services/zeptomail-email.service';
import type { User } from '../../users/entities/user.entity';
import { UserRepository } from '../../users/repositories/users.repository';
import { Verification } from '../entities/verification.entity';

@Injectable()
export class AuthEmailVerificationService {
  private readonly logger = new Logger(AuthEmailVerificationService.name);
  private readonly maxOtpFailedAttempts = 5;
  private readonly otpLockDurationMinutes = 30;

  constructor(
    private readonly userRepository: UserRepository,
    @InjectRepository(Verification)
    private readonly verificationRepository: Repository<Verification>,
    private readonly rateLimitService: RateLimitService,
    private readonly zeptomailEmailService: ZeptomailEmailService,
    private readonly productAnalytics: ProductAnalyticsService,
  ) {}

  private emailVerificationIdentifier(userId: string): string {
    return `email-verification:${userId}`;
  }

  async sendEmailVerificationOtp(user: User): Promise<void> {
    const rate = await this.rateLimitService.checkRateLimit(`email-verification:send:${user.id}`, {
      rules: [{ windowMs: 15 * 60 * 1000, maxRequests: 3 }],
    });
    if (!rate.allowed)
      throw new BadRequestException(
        `Too many verification code requests. Try again in ${rate.retryAfter ?? 60}s`,
      );
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
        { rules: [{ windowMs: 15 * 60 * 1000, maxRequests: 10 }] },
      );
      if (!ipRate.allowed)
        throw new BadRequestException('Too many verification requests. Please try again later.');
    }
    const user = await this.userRepository.findUserByEmail(StringUtility.trimAndLowerCase(email));
    if (user && !user.emailVerified) await this.sendEmailVerificationOtp(user);
    return { message: 'If this account needs verification, a code was sent.' };
  }

  async verifyEmail(email: string, code: string): Promise<User> {
    const user = await this.userRepository.findUserByEmail(StringUtility.trimAndLowerCase(email));
    if (!user || user.emailVerified)
      throw new UnauthorizedException('Invalid or expired verification code');
    const lockKey = `email-verification:${user.id}`;
    const lock = await this.rateLimitService.getLockout(lockKey);
    if (this.rateLimitService.isLocked(lock))
      throw new UnauthorizedException('Too many failed attempts. Try again later.');
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
}
