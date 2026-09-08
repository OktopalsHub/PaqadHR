import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { GeoRequestContext } from 'src/common/utils/geo-location.util';
import {
  isBillingGatewayEnabled,
  isFeatureGatingEnabled,
} from '../subscriptions/config/billing.config';
import { TenantsService } from '../tenants/tenants.service';
import type { User } from '../users/entities/user.entity';
import { UserRepository } from '../users/repositories/users.repository';
import type { OtpPurpose } from './dto/otp.dto';
import type { SessionBootstrapResponseDto } from './dto/session-bootstrap-response.dto';
import { type AuthAuditContext, AuthCredentialService } from './services/auth-credential.service';
import { AuthEmailVerificationService } from './services/auth-email-verification.service';
import { AuthOAuthService } from './services/auth-oauth.service';
import { AuthPasswordService } from './services/auth-password.service';
import { AuthSessionService } from './services/auth-session.service';

export type { AuthAuditContext };

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tenantsService: TenantsService,
    private readonly credentialService: AuthCredentialService,
    private readonly sessionService: AuthSessionService,
    private readonly emailVerificationService: AuthEmailVerificationService,
    private readonly passwordService: AuthPasswordService,
    private readonly oauthService: AuthOAuthService,
  ) {}

  async validateUser(
    email: string,
    password: string,
    auditContext?: AuthAuditContext,
  ): Promise<User | null> {
    return this.credentialService.validateUser(email, password, auditContext);
  }

  async login(
    user: User,
    geo: GeoRequestContext = {},
    auditContext?: AuthAuditContext,
    rememberMe = false,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.credentialService.login(user, geo, auditContext, rememberMe);
  }

  async register(
    email: string,
    password: string,
    geo: GeoRequestContext = {},
    inviteToken?: string,
    termsAccepted?: boolean,
  ): Promise<{ user: User; invitation?: unknown }> {
    return this.credentialService.register(email, password, geo, inviteToken, termsAccepted);
  }

  async findOrCreateGoogleUser(
    googleId: string,
    email: string,
    geo: GeoRequestContext = {},
    termsAccepted = false,
    acceptedPolicyVersion?: string,
  ): Promise<User> {
    return this.oauthService.findOrCreateGoogleUser(
      googleId,
      email,
      geo,
      termsAccepted,
      acceptedPolicyVersion,
    );
  }

  async refreshToken(refreshToken: string) {
    return this.sessionService.refreshToken(refreshToken);
  }

  async logout(userId: string) {
    return this.sessionService.logout(userId);
  }

  async logoutByRefreshToken(refreshToken: string) {
    return this.sessionService.logoutByRefreshToken(refreshToken);
  }

  async getActiveSessionsForUser(userId: string) {
    return this.sessionService.getActiveSessionsForUser(userId);
  }

  async sendEmailVerificationOtp(user: User): Promise<void> {
    return this.emailVerificationService.sendEmailVerificationOtp(user);
  }

  async resendEmailVerification(email: string, ip?: string): Promise<{ message: string }> {
    return this.emailVerificationService.resendEmailVerification(email, ip);
  }

  async verifyEmail(email: string, code: string): Promise<User> {
    return this.emailVerificationService.verifyEmail(email, code);
  }

  async forgotPassword(email: string, ip?: string) {
    return this.passwordService.forgotPassword(email, ip);
  }

  async resetPassword(token: string, newPassword: string) {
    return this.passwordService.resetPassword(token, newPassword);
  }

  async hasCredentialAccount(userId: string): Promise<boolean> {
    return this.passwordService.hasCredentialAccount(userId);
  }

  async sendOtp(userId: string, email: string, purpose: OtpPurpose) {
    return this.passwordService.sendOtp(userId, email, purpose);
  }

  async verifyOtp(userId: string, purpose: OtpPurpose, code: string) {
    return this.passwordService.verifyOtp(userId, purpose, code);
  }

  assertOtpProof(otpProof: string, userId: string, purpose: OtpPurpose): void {
    this.passwordService.assertOtpProof(otpProof, userId, purpose);
  }

  async changePassword(userId: string, otpProof: string, newPassword: string) {
    return this.passwordService.changePassword(userId, otpProof, newPassword);
  }

  async getSessionBootstrap(userId: string): Promise<SessionBootstrapResponseDto> {
    const user = await this.userRepository.findUser(userId);
    if (!user?.isActive || !user.emailVerified)
      throw new UnauthorizedException('Not authenticated');
    const workspaces = await this.tenantsService.getSessionWorkspaces(userId);
    return {
      user: { id: user.id, email: user.email, role: user.role },
      paymentsEnabled: isBillingGatewayEnabled(),
      featureGatingEnabled: isFeatureGatingEnabled(),
      workspaces,
    };
  }
}
