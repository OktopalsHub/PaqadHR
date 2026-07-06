import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
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
    };
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
    } as User;

    it('rotates session token on refresh', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1', sid: 'old-session' });
      userRepository.findUser.mockResolvedValue(mockUser);
      sessionRepository.findOne.mockResolvedValue({
        token: 'old-session',
        userId: 'user-1',
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

    it('revokes all sessions when refresh token is reused', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1', sid: 'stale-session' });
      userRepository.findUser.mockResolvedValue(mockUser);
      sessionRepository.findOne.mockResolvedValue(null);

      await expect(authService.refreshToken('stale-refresh')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(sessionRepository.delete).toHaveBeenCalledWith({ userId: 'user-1' });
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

      await authService.resetPassword(rawToken, 'new-password-1');

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
});
