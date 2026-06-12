import { Test, TestingModule } from '@nestjs/testing';
import { AuditQueueService, AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { PasswordService } from 'src/common/utils';
import { InvitationsService } from '../invitations/invitations.service';
import { TenantMembersService } from '../tenant-members/tenant-members.service';
import { TenantsService } from '../tenants/tenants.service';
import { UserRole } from '../../../common/enums';
import { UserRepository } from "../users/repositories/users.repository";
import { RefreshTokenRepository } from "../users/repositories/refresh-token.repository";
import { User } from "../users/entities/user.entity";

describe('AuthService', () => {
  let authService: AuthService;
  let userRepository: jest.Mocked<UserRepository>;
  let auditQueueService: jest.Mocked<AuditQueueService>;
  beforeEach(async () => {
    const mockUserRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      createRefreshToken: jest.fn(),
    };
    const mockJwtService = {
      sign: jest.fn().mockReturnValue('mocked-jwt-token'),
    };
    const mockRefreshTokenRepository = {
      findActiveTokenByUserId: jest.fn().mockResolvedValue([]),
    };
    const mockInvitationsService = {
      acceptInvitation: jest.fn(),
    };
    const mockTenantMembersService = {
      createTenantMember: jest.fn(),
    };
    const mockTenantsService = {
      getTenantBySlug: jest.fn(),
    };
    const mockAuditQueueService = {
      enqueue: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: RefreshTokenRepository, useValue: mockRefreshTokenRepository },
        { provide: InvitationsService, useValue: mockInvitationsService },
        { provide: TenantMembersService, useValue: mockTenantMembersService },
        { provide: TenantsService, useValue: mockTenantsService },
        { provide: AuditQueueService, useValue: mockAuditQueueService },
      ],
    }).compile();
    authService = module.get<AuthService>(AuthService);
    userRepository = module.get(UserRepository);
    auditQueueService = module.get(AuditQueueService);
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  describe('validateUser', () => {
    it('should throw UnauthorizedException when user is not found', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(
        authService.validateUser('notfound@example.com', 'password123')
      ).rejects.toThrow(UnauthorizedException);
    });
    it('should throw UnauthorizedException when password does not match', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        password: 'hashedpassword',
        isActive: true,
      } as User;
      userRepository.findOne.mockResolvedValue(mockUser);
      jest.spyOn(PasswordService, 'verifyPassword').mockResolvedValue(false);
      await expect(
        authService.validateUser('test@example.com', 'wrongpassword')
      ).rejects.toThrow(UnauthorizedException);
    });
    it('should return the user object when credentials are valid', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        password: 'hashedpassword',
        isActive: true,
        role: UserRole.BASIC,
      } as User;
      userRepository.findOne.mockResolvedValue(mockUser);
      jest.spyOn(PasswordService, 'verifyPassword').mockResolvedValue(true);
      const result = await authService.validateUser('test@example.com', 'correctpassword');
      expect(result).toBeDefined();
      expect(result?.id).toBe('1');
      expect(result?.email).toBe('test@example.com');
    });
    it('should enqueue an audit log if login fails and audit context is provided', async () => {
      userRepository.findOne.mockResolvedValue(null);
      const auditContext = { ip: '127.0.0.1', userAgent: 'test-agent' };
      await expect(
        authService.validateUser('test@example.com', 'password', auditContext)
      ).rejects.toThrow(UnauthorizedException);
      expect(auditQueueService.enqueue).toHaveBeenCalledTimes(1);
      expect(auditQueueService.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN_FAILED',
          description: 'Invalid email or password',
        })
      );
    });
  });
});
