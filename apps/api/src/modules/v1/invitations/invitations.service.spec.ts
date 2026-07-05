import { BadRequestException } from '@nestjs/common';
import { InvitationStatus } from '../../../common/enums';
import { InvitationsService } from './invitations.service';

describe('InvitationsService', () => {
  const baseInvitation = {
    id: 'inv-1',
    email: 'existing@example.com',
    tenantId: 'tenant-1',
    firstName: 'Ada' as string | null,
    lastName: 'Lovelace' as string | null,
    role: 'member',
    status: InvitationStatus.PENDING,
    invitedBy: 'member-1',
    expiresAt: new Date(Date.now() + 86_400_000),
    token: 'token-abc',
  };

  function buildService(overrides?: {
    existingUser?: { id: string; email: string; role: string } | null;
    invitation?: Partial<typeof baseInvitation> & {
      departmentId?: string;
      positionId?: string;
      firstName?: string | null;
      lastName?: string | null;
    };
    createTenantMemberResult?: { id: string };
  }) {
    const invitation = { ...baseInvitation, ...overrides?.invitation };
    const invitationsRepository = {
      findInvitationByToken: jest.fn().mockResolvedValue(invitation),
      findInvitationByEmail: jest.fn().mockResolvedValue([]),
      save: jest
        .fn()
        .mockImplementation(async (data) => ({ ...invitation, ...data, id: 'inv-new' })),
      create: jest.fn().mockImplementation((data) => data),
      acceptInvitation: jest
        .fn()
        .mockResolvedValue({ ...invitation, status: InvitationStatus.ACCEPTED }),
      softDelete: jest.fn().mockResolvedValue(undefined),
    };
    const tenantMembersService = {
      checkUserTenantMembership: jest.fn().mockResolvedValue(null),
      createTenantMember: jest
        .fn()
        .mockResolvedValue(overrides?.createTenantMemberResult ?? { id: 'member-new' }),
    };
    const usersService = {
      getUserByEmail: jest.fn().mockResolvedValue(overrides?.existingUser ?? null),
      createUser: jest.fn().mockResolvedValue({ id: 'user-new', email: invitation.email }),
      updateUser: jest.fn(),
    };
    const tenantsService = {
      getTenant: jest.fn().mockResolvedValue({ id: 'tenant-1', name: 'Acme', slug: 'acme' }),
    };
    const rateLimitService = {
      checkRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
      clearRateLimit: jest.fn(),
    };
    const zeptomailEmailService = {
      sendTemplateEmail: jest.fn().mockResolvedValue({ success: true }),
    };
    const activitiesService = { queueActivity: jest.fn().mockResolvedValue(undefined) };
    const departmentsService = {
      addMemberToDepartment: jest.fn().mockResolvedValue({ success: true }),
    };
    const positionMemberService = {
      assignPosition: jest.fn().mockResolvedValue({ id: 'pos-member-1' }),
    };

    const service = new InvitationsService(
      invitationsRepository as any,
      tenantMembersService as any,
      usersService as any,
      tenantsService as any,
      rateLimitService as any,
      zeptomailEmailService as any,
      activitiesService as any,
      departmentsService as any,
      positionMemberService as any,
    );

    return {
      service,
      invitationsRepository,
      tenantMembersService,
      usersService,
      departmentsService,
      positionMemberService,
    };
  }

  describe('createInvitation', () => {
    it('creates an email-only invitation without first or last name', async () => {
      const { service, invitationsRepository } = buildService();

      await service.createInvitation(
        { email: 'new@example.com', role: 'member', departmentId: 'dept-1', positionId: 'pos-1' },
        'tenant-1',
        'member-1',
      );

      expect(invitationsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          firstName: undefined,
          lastName: undefined,
          departmentId: 'dept-1',
          positionId: 'pos-1',
        }),
      );
      expect(invitationsRepository.save).toHaveBeenCalled();
    });
  });

  describe('acceptInvitation', () => {
    it('accepts for an existing user without firstName/lastName in the body', async () => {
      const { service, tenantMembersService } = buildService({
        existingUser: { id: 'user-1', email: 'existing@example.com', role: 'member' },
      });

      const result = await service.acceptInvitation('token-abc', 'existing@example.com', {});

      expect(result.userExists).toBe(true);
      expect(tenantMembersService.createTenantMember).toHaveBeenCalledWith(
        'user-1',
        'tenant-1',
        expect.objectContaining({
          firstName: 'Ada',
          lastName: 'Lovelace',
          role: 'member',
        }),
      );
    });

    it('requires names for a new user when invitation names are missing', async () => {
      const { service, invitationsRepository } = buildService();
      invitationsRepository.findInvitationByToken.mockResolvedValue({
        ...baseInvitation,
        firstName: null,
        lastName: null,
      } as typeof baseInvitation);

      await expect(
        service.acceptInvitation('token-abc', 'existing@example.com', {
          password: 'password123',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('applies department and position from the invitation after member creation', async () => {
      const { service, departmentsService, positionMemberService } = buildService({
        invitation: {
          email: 'new@example.com',
          departmentId: 'dept-1',
          positionId: 'pos-1',
          firstName: undefined,
          lastName: undefined,
        },
      });

      await service.acceptInvitation('token-abc', 'new@example.com', {
        password: 'password123',
        firstName: 'Grace',
        lastName: 'Hopper',
        preferredName: 'Grace',
      });

      expect(departmentsService.addMemberToDepartment).toHaveBeenCalledWith(
        'tenant-1',
        'dept-1',
        'member-new',
      );
      expect(positionMemberService.assignPosition).toHaveBeenCalledWith(
        'tenant-1',
        'member-new',
        'pos-1',
      );
    });
  });
});
