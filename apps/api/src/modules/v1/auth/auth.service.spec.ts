import {
  BadRequestException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProductAnalyticsService } from 'src/common/observability/product-analytics.service';
import { RateLimitService } from 'src/common/services/rate-limit.service';
import { PasswordService, sha256Hex } from 'src/common/utils';
import { UserRole } from '../../../common/enums';
import { AuditLogsService } from '../audit-logs/services/audit-logs.service';
import { InvitationsService } from '../invitations/invitations.service';
import { ZeptomailEmailService } from '../notifications/services/zeptomail-email.service';
import { TenantMembersService } from '../tenant-members/tenant-members.service';
import type { User } from '../users/entities/user.entity';
import { UserRepository } from '../users/repositories/users.repository';
import { AuthService } from './auth.service';
import { Account } from './entities/account.entity';
import { Session } from './entities/session.entity';
import { Verification } from './entities/verification.entity';

describe('AuthService', () => {
  let authService: AuthService;
  let userRepository: jest.Mocked<UserRepository>;
  let accountRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let auditLogsService: jest.Mocked<Pick<AuditLogsService, 'queueAuditLog'>>;
  let zeptomailEmailService: { sendTemplateEmail: jest.Mock };
  let verificationRepository: {
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
    findOne: jest.Mock;
  };
  let sessionRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    delete: jest.Mock;
    find: jest.Mock;
  };
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  let rateLimitService: { checkRateLimit: jest.Mock };

  beforeEach(async () => {
    const mockUserRepository = {
      findUserByEmail: jest.fn(),
      findUser: jest.fn(),
      insertUser: jest.fn(),
      update: jest.fn(),
      save: jest.fn(),
    };
    const mockJwtService = {
      sign: jest.fn().mockReturnValue('mocked-jwt-token'),
      verify: jest.fn(),
    };
    jwtService = mockJwtService;
    accountRepository = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (account) => account),
      create: jest.fn().mockImplementation((data) => data),
    };
    const mockSessionRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
      find: jest.fn(),
    };
    sessionRepository = mockSessionRepository;
    const mockVerificationRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    };
    const mockInvitationsService = {
      acceptInvitation: jest.fn(),
    };
    const mockTenantMembersService = {
      createTenantMember: jest.fn(),
    };
    const mockAuditLogsService = {
      queueAuditLog: jest.fn(),
    };
    const mockRateLimitService = {
      checkRateLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 3, resetTime: 0 }),
      clearRateLimit: jest.fn(),
      getLockout: jest.fn().mockResolvedValue(undefined),
      recordLockoutFailure: jest.fn(),
      clearLockout: jest.fn(),
      isLocked: jest.fn().mockReturnValue(false),
    };
    rateLimitService = mockRateLimitService;
    const mockZeptomailEmailService = {
      sendTemplateEmail: jest.fn().mockResolvedValue({ success: true }),
    };
    zeptomailEmailService = mockZeptomailEmailService;
    verificationRepository = mockVerificationRepository;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: getRepositoryToken(Account), useValue: accountRepository },
        { provide: getRepositoryToken(Session), useValue: mockSessionRepository },
        {
          provide: getRepositoryToken(Verification),
          useValue: mockVerificationRepository,
        },
        { provide: InvitationsService, useValue: mockInvitationsService },
        { provide: TenantMembersService, useValue: mockTenantMembersService },
        { provide: AuditLogsService, useValue: mockAuditLogsService },
        { provide: RateLimitService, useValue: mockRateLimitService },
        { provide: ZeptomailEmailService, useValue: mockZeptomailEmailService },
        {
          provide: ProductAnalyticsService,
          useValue: { capture: jest.fn(), identify: jest.fn() },
        },
      ],
    }).compile();
    authService = module.get<AuthService>(AuthService);
    userRepository = module.get(UserRepository);
    auditLogsService = module.get(AuditLogsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should throw UnauthorizedException when user is not found', async () => {
      userRepository.findUserByEmail.mockResolvedValue(null);
      await expect(authService.validateUser('notfound@example.com', 'password123')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when password does not match', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        password: 'hashedpassword',
        isActive: true,
      } as User;
      userRepository.findUserByEmail.mockResolvedValue(mockUser);
      accountRepository.findOne.mockResolvedValue(null);
      jest.spyOn(PasswordService, 'verifyPassword').mockResolvedValue(false);
      await expect(authService.validateUser('test@example.com', 'wrongpassword')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return the user object when credentials are valid', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        password: 'hashedpassword',
        isActive: true,
        emailVerified: true,
        role: UserRole.BASIC,
      } as User;
      userRepository.findUserByEmail.mockResolvedValue(mockUser);
      accountRepository.findOne.mockResolvedValue(null);
      jest.spyOn(PasswordService, 'verifyPassword').mockResolvedValue(true);
      const result = await authService.validateUser('test@example.com', 'correctpassword');
      expect(result).toBeDefined();
      expect(result?.id).toBe('1');
      expect(result?.email).toBe('test@example.com');
    });

    it('should enqueue an audit log if login fails and audit context is provided', async () => {
      userRepository.findUserByEmail.mockResolvedValue(null);
      const auditContext = { ipAddress: '127.0.0.1', userAgent: 'test-agent' };
      await expect(
        authService.validateUser('test@example.com', 'password', auditContext),
      ).rejects.toThrow(UnauthorizedException);
      expect(auditLogsService.queueAuditLog).toHaveBeenCalledTimes(1);
      expect(auditLogsService.queueAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN_FAILED',
          description: 'Invalid email or password',
        }),
      );
    });

    it('should reject an unverified email even with correct credentials', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        password: 'hashedpassword',
        isActive: true,
        emailVerified: false,
      } as User;
      userRepository.findUserByEmail.mockResolvedValue(mockUser);
      accountRepository.findOne.mockResolvedValue(null);
      jest.spyOn(PasswordService, 'verifyPassword').mockResolvedValue(true);

      await expect(authService.validateUser('test@example.com', 'correctpassword')).rejects.toThrow(
        'Verify your email address before signing in',
      );
    });
  });

  describe('findOrCreateGoogleUser', () => {
    it('links Google to an existing credential user with the same email', async () => {
      const existingUser = {
        id: 'user-1',
        email: 'test@example.com',
        isActive: true,
        emailVerified: false,
      } as User;

      accountRepository.findOne.mockResolvedValue(null);
      userRepository.findUserByEmail.mockResolvedValue(existingUser);
      userRepository.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      const result = await authService.findOrCreateGoogleUser('google-123', 'test@example.com');

      expect(result).toBe(existingUser);
      expect(accountRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          providerId: 'google',
          accountId: 'google-123',
        }),
      );
      expect(userRepository.update).toHaveBeenCalledWith('user-1', { emailVerified: true });
    });

    it('returns user when Google account is already linked', async () => {
      const existingUser = { id: 'user-1', email: 'test@example.com', isActive: true } as User;
      accountRepository.findOne.mockResolvedValue({ user: existingUser });

      const result = await authService.findOrCreateGoogleUser('google-123', 'test@example.com');

      expect(result).toBe(existingUser);
      expect(userRepository.findUserByEmail).not.toHaveBeenCalled();
    });

    it('returns user when Google is already linked to an existing email account', async () => {
      const existingUser = {
        id: 'user-1',
        email: 'test@example.com',
        isActive: true,
        emailVerified: true,
      } as User;

      accountRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ userId: 'user-1', providerId: 'google', accountId: 'google-123' });
      userRepository.findUserByEmail.mockResolvedValue(existingUser);

      const result = await authService.findOrCreateGoogleUser('google-123', 'test@example.com');

      expect(result).toBe(existingUser);
      expect(accountRepository.save).not.toHaveBeenCalled();
    });

    it('stores ISO country from geoip on new Google signup', async () => {
      accountRepository.findOne.mockResolvedValue(null);
      userRepository.findUserByEmail.mockResolvedValue(null);
      userRepository.insertUser.mockResolvedValue({
        id: 'user-new',
        email: 'new@example.com',
      } as User);
      accountRepository.create.mockImplementation((data) => data);

      await authService.findOrCreateGoogleUser(
        'google-new',
        'new@example.com',
        {
          ip: '8.8.8.8',
          headers: {},
        },
        true,
        '1.0',
      );

      expect(userRepository.insertUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          countryCode: 'US',
          metadata: expect.objectContaining({
            consent: expect.objectContaining({
              privacyPolicyVersion: expect.any(String),
            }),
          }),
        }),
      );
    });

    it('rejects new Google signup without verified consent', async () => {
      accountRepository.findOne.mockResolvedValue(null);
      userRepository.findUserByEmail.mockResolvedValue(null);

      await expect(
        authService.findOrCreateGoogleUser('google-new', 'new@example.com', {}, false),
      ).rejects.toThrow(BadRequestException);
      expect(userRepository.insertUser).not.toHaveBeenCalled();
    });

    it('rejects new Google signup when accepted policy version is stale', async () => {
      accountRepository.findOne.mockResolvedValue(null);
      userRepository.findUserByEmail.mockResolvedValue(null);

      await expect(
        authService.findOrCreateGoogleUser('google-new', 'new@example.com', {}, true, '0.9'),
      ).rejects.toThrow(BadRequestException);
      expect(userRepository.insertUser).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    it('never returns resetToken in the response', async () => {
      userRepository.findUserByEmail.mockResolvedValue(null);

      const result = await authService.forgotPassword('nobody@example.com');

      expect(result).toEqual({ message: 'If email exists, a reset link was sent' });
      expect(result).not.toHaveProperty('resetToken');
      expect(zeptomailEmailService.sendTemplateEmail).not.toHaveBeenCalled();
    });

    it('sends password-reset email when user exists', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' } as User;
      userRepository.findUserByEmail.mockResolvedValue(mockUser);
      verificationRepository.create.mockImplementation((data) => data);
      verificationRepository.save.mockResolvedValue(undefined);
      verificationRepository.delete.mockResolvedValue(undefined);

      const result = await authService.forgotPassword('test@example.com');

      expect(result).not.toHaveProperty('resetToken');
      expect(zeptomailEmailService.sendTemplateEmail).toHaveBeenCalledWith(
        'test@example.com',
        'password-reset',
        expect.objectContaining({
          resetLink: expect.stringContaining('/reset-password?token='),
        }),
      );
      const savedToken = verificationRepository.create.mock.calls[0][0].token;
      expect(savedToken).not.toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(savedToken).toHaveLength(64);
    });
  });

  describe('verifyOtp', () => {
    it('returns otpProof when code is valid', async () => {
      verificationRepository.findOne.mockResolvedValue({
        id: 'v1',
        identifier: 'otp:password_change:user-1',
        token: 'hashed-code',
        expiresAt: new Date(Date.now() + 60_000),
      });
      jest.spyOn(PasswordService, 'verifyPassword').mockResolvedValue(true);

      const result = await authService.verifyOtp('user-1', 'password_change', '123456');

      expect(result).toEqual({ otpProof: 'mocked-jwt-token' });
      expect(verificationRepository.delete).toHaveBeenCalledWith('v1');
    });

    it('rejects invalid verification code', async () => {
      verificationRepository.findOne.mockResolvedValue({
        id: 'v1',
        identifier: 'otp:password_change:user-1',
        token: 'hashed-code',
        expiresAt: new Date(Date.now() + 60_000),
      });
      jest.spyOn(PasswordService, 'verifyPassword').mockResolvedValue(false);

      await expect(authService.verifyOtp('user-1', 'password_change', '000000')).rejects.toThrow(
        'Invalid or expired verification code',
      );
    });
  });

  describe('refreshToken', () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      role: UserRole.BASIC,
      emailVerified: true,
    } as User;

    it('rotates session token on refresh', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1', sid: 'old-session' });
      userRepository.findUser.mockResolvedValue(mockUser);
      sessionRepository.findOne.mockResolvedValue({
        token: 'old-session',
        userId: 'user-1',
        createdAt: new Date(Date.now() - 3_600_000),
        expiresAt: new Date(Date.now() + 60_000),
      });
      sessionRepository.save.mockImplementation(async (session) => session);

      await authService.refreshToken('valid-refresh');

      expect(sessionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          token: expect.not.stringMatching(/^old-session$/),
          userId: 'user-1',
        }),
      );
      expect(jwtService.sign).toHaveBeenCalled();
    });

    it('revokes all sessions when a stale refresh token is reused', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1', sid: 'stale-session' });
      userRepository.findUser.mockResolvedValue(mockUser);
      sessionRepository.findOne.mockResolvedValue(null);

      await expect(authService.refreshToken('stale-refresh')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(sessionRepository.delete).toHaveBeenCalledWith({ userId: 'user-1' });
    });

    it('revokes all sessions on a repeated refresh attempt after rotation', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1', sid: 'old-session' });
      userRepository.findUser.mockResolvedValue(mockUser);

      let activeSession = {
        token: 'old-session',
        userId: 'user-1',
        createdAt: new Date(Date.now() - 3_600_000),
        expiresAt: new Date(Date.now() + 60_000),
      };

      sessionRepository.findOne.mockImplementation(async ({ where }) => {
        if (where?.userId === activeSession.userId && where?.token === activeSession.token) {
          return activeSession;
        }
        return null;
      });
      sessionRepository.save.mockImplementation(async (session) => {
        activeSession = {
          token: session.token,
          userId: session.userId,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
        };
        return activeSession;
      });

      await authService.refreshToken('valid-refresh');

      await expect(authService.refreshToken('stale-refresh')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(activeSession.token).not.toBe('old-session');
      expect(sessionRepository.delete).toHaveBeenCalledWith({ userId: 'user-1' });
    });
  });

  describe('verifyEmail', () => {
    it('activates an account only after a valid email verification code', async () => {
      const user = {
        id: 'user-1',
        email: 'test@example.com',
        isActive: true,
        emailVerified: false,
      } as User;
      userRepository.findUserByEmail.mockResolvedValue(user);
      verificationRepository.findOne.mockResolvedValue({
        id: 'verification-1',
        identifier: 'email-verification:user-1',
        token: 'hashed-code',
        expiresAt: new Date(Date.now() + 60_000),
      });
      jest.spyOn(PasswordService, 'verifyPassword').mockResolvedValue(true);

      const result = await authService.verifyEmail('test@example.com', '123456');

      expect(result.emailVerified).toBe(true);
      expect(userRepository.update).toHaveBeenCalledWith('user-1', { emailVerified: true });
      expect(verificationRepository.delete).toHaveBeenCalledWith('verification-1');
    });
  });

  describe('resendEmailVerification', () => {
    it('limits requests by IP before looking up the account', async () => {
      rateLimitService.checkRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 60 });

      await expect(
        authService.resendEmailVerification('test@example.com', '203.0.113.1'),
      ).rejects.toThrow(BadRequestException);

      expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
        'email-verification:resend-ip:203.0.113.1',
        { rules: [{ windowMs: 15 * 60 * 1000, maxRequests: 10 }] },
      );
      expect(userRepository.findUserByEmail).not.toHaveBeenCalled();
    });
  });

  describe('sendEmailVerificationOtp', () => {
    it('persists the code but does not fail registration when email delivery is unavailable', async () => {
      const user = { id: 'user-1', email: 'test@example.com' } as User;
      verificationRepository.create.mockImplementation((data) => data);
      zeptomailEmailService.sendTemplateEmail.mockRejectedValue(new Error('provider down'));

      await expect(authService.sendEmailVerificationOtp(user)).resolves.toBeUndefined();

      expect(verificationRepository.save).toHaveBeenCalled();
      expect(zeptomailEmailService.sendTemplateEmail).toHaveBeenCalledWith(
        'test@example.com',
        'otp-verification',
        expect.objectContaining({ purposeLabel: 'verifying your email address' }),
      );
    });
  });

  describe('resetPassword', () => {
    it('looks up reset token by sha256 hash', async () => {
      const rawToken = '550e8400-e29b-41d4-a716-446655440000';
      verificationRepository.findOne.mockResolvedValue({
        id: 'v1',
        identifier: 'reset:user-1',
        token: sha256Hex(rawToken),
        expiresAt: new Date(Date.now() + 60_000),
      });
      userRepository.findUser.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      } as User);
      userRepository.save.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      } as User);
      accountRepository.findOne.mockResolvedValue(null);
      jest.spyOn(PasswordService, 'hashPassword').mockResolvedValue('new-hash');

      await authService.resetPassword(rawToken, 'NewPassword1!');

      expect(verificationRepository.findOne).toHaveBeenCalledWith({
        where: { token: sha256Hex(rawToken) },
      });
    });

    it('returns generic message when email send fails', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' } as User;
      userRepository.findUserByEmail.mockResolvedValue(mockUser);
      verificationRepository.create.mockImplementation((data) => data);
      verificationRepository.save.mockResolvedValue(undefined);
      verificationRepository.delete.mockResolvedValue(undefined);
      zeptomailEmailService.sendTemplateEmail.mockRejectedValue(new Error('provider down'));

      const result = await authService.forgotPassword('test@example.com');

      expect(result).toEqual({ message: 'If email exists, a reset link was sent' });
    });
  });

  describe('register', () => {
    it('rejects a password that does not meet the password policy', async () => {
      await expect(
        authService.register('test@example.com', 'numbers123', {}, undefined, true),
      ).rejects.toThrow(
        'Password must be at least 8 characters and include an uppercase letter, lowercase letter, number, and special character.',
      );
    });

    it('returns the existing user when email and password match a credential account', async () => {
      const existingUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashedpassword',
        isActive: true,
        role: UserRole.BASIC,
        emailVerified: false,
        metadata: { other: 'keep' },
      } as unknown as User;

      userRepository.findUserByEmail.mockResolvedValue(existingUser);
      accountRepository.findOne.mockResolvedValue({
        userId: 'user-1',
        providerId: 'credential',
        password: 'hashedpassword',
      });
      jest.spyOn(PasswordService, 'verifyPassword').mockResolvedValue(true);

      const result = await authService.register(
        'test@example.com',
        'CorrectPassword1!',
        { ip: '127.0.0.1' },
        undefined,
        true,
      );

      expect(result.user).toBe(existingUser);
      expect(userRepository.insertUser).not.toHaveBeenCalled();
      expect(userRepository.update).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          metadata: expect.objectContaining({
            other: 'keep',
            consent: expect.objectContaining({
              privacyPolicyVersion: expect.any(String),
            }),
          }),
        }),
      );
    });

    it('rejects registration when the email exists but the password is wrong', async () => {
      const existingUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashedpassword',
        isActive: true,
      } as User;

      userRepository.findUserByEmail.mockResolvedValue(existingUser);
      accountRepository.findOne.mockResolvedValue({
        userId: 'user-1',
        providerId: 'credential',
        password: 'hashedpassword',
      });
      jest.spyOn(PasswordService, 'verifyPassword').mockResolvedValue(false);

      await expect(
        authService.register(
          'test@example.com',
          'WrongPassword1!',
          { ip: '127.0.0.1' },
          undefined,
          true,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects registration when the email already belongs to a verified Google account', async () => {
      const existingUser = {
        id: 'user-1',
        email: 'test@example.com',
        isActive: true,
        emailVerified: true,
      } as User;

      userRepository.findUserByEmail.mockResolvedValue(existingUser);
      await expect(
        authService.register(
          'test@example.com',
          'NewPassword123!',
          { ip: '127.0.0.1' },
          undefined,
          true,
        ),
      ).rejects.toThrow('This email is already registered. Please sign in.');
      expect(userRepository.insertUser).not.toHaveBeenCalled();
    });

    it('rejects registration when the email exists without a supported sign-in method', async () => {
      const existingUser = {
        id: 'user-1',
        email: 'test@example.com',
        isActive: true,
      } as User;

      userRepository.findUserByEmail.mockResolvedValue(existingUser);
      accountRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      await expect(
        authService.register(
          'test@example.com',
          'Password123!',
          { ip: '127.0.0.1' },
          undefined,
          true,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });
});
