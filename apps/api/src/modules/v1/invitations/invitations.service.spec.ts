import { BadRequestException, ConflictException } from '@nestjs/common';

import { InvitationStatus } from '../../../common/enums';
import { InvitationsService } from './invitations.service';
import { InvitationAcceptanceService } from './services/invitation-acceptance.service';
import { InvitationManagementService } from './services/invitation-management.service';
import { InvitationSendingService } from './services/invitation-sending.service';

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
      claimPending: jest.fn().mockResolvedValue(true),
      releaseClaim: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue({ ...invitation, status: InvitationStatus.DECLINED }),
    };
    const tenantMembersService = {
      checkUserTenantMembership: jest.fn().mockResolvedValue(null),
      findUserTenantMembership: jest.fn().mockResolvedValue(null),
      createTenantMember: jest
        .fn()
        .mockResolvedValue(overrides?.createTenantMemberResult ?? { id: 'member-new' }),
      getTenantMember: jest.fn().mockResolvedValue({
        firstName: 'Admin',
        lastName: 'User',
        user: { email: 'admin@example.com' },
      }),
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
    const notificationHelperService = {
      sendWelcomeNotification: jest.fn().mockResolvedValue(undefined),
      sendNewTeamMemberNotification: jest.fn().mockResolvedValue(undefined),
      sendInvitationDeclinedNotification: jest.fn().mockResolvedValue(undefined),
    };

    const productAnalytics = { capture: jest.fn() };

    const managementService = new InvitationManagementService(
      invitationsRepository as any,
      tenantsService as any,
      usersService as any,
      rateLimitService as any,
      tenantMembersService as any,
      zeptomailEmailService as any,
      activitiesService as any,
      productAnalytics as any,
    );
    const sendingService = new InvitationSendingService(
      invitationsRepository as any,
      usersService as any,
      tenantMembersService as any,
      managementService,
    );
    const acceptanceService = new InvitationAcceptanceService(
      invitationsRepository as any,
      usersService as any,
      tenantMembersService as any,
      tenantsService as any,
      departmentsService as any,
      positionMemberService as any,
      notificationHelperService as any,
      activitiesService as any,
      productAnalytics as any,
      rateLimitService as any,
      managementService,
    );
    const service = new InvitationsService(managementService, sendingService, acceptanceService);

    return {
      service,
      invitationsRepository,
      tenantMembersService,
      usersService,
      departmentsService,
      positionMemberService,
      zeptomailEmailService,
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

    it('returns emailSent false when Zeptomail fails', async () => {
      const { service, zeptomailEmailService } = buildService();
      zeptomailEmailService.sendTemplateEmail.mockResolvedValue({
        success: false,
        error: 'smtp down',
      });

      const result = await service.createInvitation(
        { email: 'new@example.com', role: 'member' },
        'tenant-1',
        'member-1',
      );

      expect(result.emailSent).toBe(false);
      expect(result.emailError).toBe('smtp down');
    });

    it('skips email when sendEmail is false', async () => {
      const { service, zeptomailEmailService } = buildService();

      const result = await service.createInvitation(
        { email: 'new@example.com', role: 'member' },
        'tenant-1',
        'member-1',
        { sendEmail: false },
      );

      expect(result.emailSent).toBe(false);
      expect(zeptomailEmailService.sendTemplateEmail).not.toHaveBeenCalled();
    });

    it('builds accept-invite links from FRONTEND_URL', async () => {
      const previous = process.env.FRONTEND_URL;
      process.env.FRONTEND_URL = 'https://app.paqadhr.com';
      const { service, zeptomailEmailService } = buildService();

      try {
        await service.createInvitation(
          { email: 'new@example.com', role: 'member' },
          'tenant-1',
          'member-1',
        );

        expect(zeptomailEmailService.sendTemplateEmail).toHaveBeenCalledWith(
          'new@example.com',
          'invitation',
          expect.objectContaining({
            inviteLink: expect.stringMatching(
              /^https:\/\/app\.paqadhr\.com\/accept-invite\?token=.+&email=new%40example\.com$/,
            ),
          }),
        );
      } finally {
        if (previous === undefined) delete process.env.FRONTEND_URL;
        else process.env.FRONTEND_URL = previous;
      }
    });

    it('allows inviting a user who belongs to another workspace', async () => {
      const { service, tenantMembersService } = buildService({
        existingUser: { id: 'user-existing', email: 'existing@other.com', role: 'member' },
      });
      tenantMembersService.findUserTenantMembership.mockResolvedValue(null);

      const result = await service.createInvitation(
        { email: 'existing@other.com', role: 'member' },
        'tenant-1',
        'member-1',
      );

      expect(tenantMembersService.findUserTenantMembership).toHaveBeenCalledWith(
        'user-existing',
        'tenant-1',
      );
      expect(result.email).toBe('existing@other.com');
      expect(result.emailSent).toBe(true);
    });

    it('blocks inviting someone who is already on this workspace', async () => {
      const { service, tenantMembersService } = buildService({
        existingUser: { id: 'user-existing', email: 'member@example.com', role: 'member' },
      });
      tenantMembersService.findUserTenantMembership.mockResolvedValue({ id: 'member-existing' });

      await expect(
        service.createInvitation(
          { email: 'member@example.com', role: 'member' },
          'tenant-1',
          'member-1',
        ),
      ).rejects.toThrow('already a member of this tenant');
    });
  });

  describe('acceptInvitation', () => {
    it('requires first and last name for an existing user', async () => {
      const { service, tenantMembersService } = buildService({
        existingUser: { id: 'user-1', email: 'existing@example.com', role: 'member' },
      });

      await expect(
        service.acceptInvitation('token-abc', 'existing@example.com', {}),
      ).rejects.toThrow('First name and last name are required');

      const result = await service.acceptInvitation('token-abc', 'existing@example.com', {
        firstName: 'Ada',
        lastName: 'Lovelace',
      });

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

    it('requires names for a new user even when invitation names are present', async () => {
      const { service } = buildService();

      await expect(
        service.acceptInvitation('token-abc', 'existing@example.com', {
          password: 'password123',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
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
        'member-new',
      );
      expect(positionMemberService.assignPosition).toHaveBeenCalledWith(
        'tenant-1',
        'member-new',
        'pos-1',
      );
    });

    it('claims the invitation before creating anything', async () => {
      const { service, invitationsRepository, usersService, tenantMembersService } = buildService({
        invitation: { email: 'new@example.com' },
      });

      await service.acceptInvitation('token-abc', 'new@example.com', {
        password: 'password123',
        firstName: 'Grace',
        lastName: 'Hopper',
      });

      expect(invitationsRepository.claimPending).toHaveBeenCalledWith(
        'inv-1',
        InvitationStatus.ACCEPTED,
      );
      expect(invitationsRepository.claimPending.mock.invocationCallOrder[0]).toBeLessThan(
        usersService.createUser.mock.invocationCallOrder[0],
      );
      expect(tenantMembersService.createTenantMember).toHaveBeenCalledTimes(1);
    });

    it('creates nothing when the claim is lost to a concurrent accept', async () => {
      const { service, invitationsRepository, usersService, tenantMembersService } = buildService({
        invitation: { email: 'new@example.com' },
      });
      invitationsRepository.claimPending.mockResolvedValue(false);

      await expect(
        service.acceptInvitation('token-abc', 'new@example.com', {
          password: 'password123',
          firstName: 'Grace',
          lastName: 'Hopper',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(usersService.createUser).not.toHaveBeenCalled();
      expect(tenantMembersService.createTenantMember).not.toHaveBeenCalled();
    });

    it('releases the claim when provisioning fails after it', async () => {
      const { service, invitationsRepository, tenantMembersService } = buildService({
        invitation: { email: 'new@example.com' },
      });
      tenantMembersService.createTenantMember.mockRejectedValue(new Error('boom'));

      await expect(
        service.acceptInvitation('token-abc', 'new@example.com', {
          password: 'password123',
          firstName: 'Grace',
          lastName: 'Hopper',
        }),
      ).rejects.toThrow('boom');

      expect(invitationsRepository.releaseClaim).toHaveBeenCalledWith(
        'inv-1',
        InvitationStatus.ACCEPTED,
      );
      expect(invitationsRepository.softDelete).not.toHaveBeenCalled();
    });

    it('rethrows the original failure when releasing the claim also fails', async () => {
      const { service, invitationsRepository, tenantMembersService } = buildService({
        invitation: { email: 'new@example.com' },
      });
      tenantMembersService.createTenantMember.mockRejectedValue(new Error('boom'));
      invitationsRepository.releaseClaim.mockRejectedValue(new Error('release failed'));

      await expect(
        service.acceptInvitation('token-abc', 'new@example.com', {
          password: 'password123',
          firstName: 'Grace',
          lastName: 'Hopper',
        }),
      ).rejects.toThrow('boom');
    });
  });

  describe('declineInvitationByTokenAndEmail', () => {
    it('declines through an atomic claim', async () => {
      const { service, invitationsRepository } = buildService();

      await service.declineInvitationByTokenAndEmail('token-abc', 'existing@example.com');

      expect(invitationsRepository.claimPending).toHaveBeenCalledWith(
        'inv-1',
        InvitationStatus.DECLINED,
      );
    });

    it('rejects when the invitation was already handled concurrently', async () => {
      const { service, invitationsRepository } = buildService();
      invitationsRepository.claimPending.mockResolvedValue(false);

      await expect(
        service.declineInvitationByTokenAndEmail('token-abc', 'existing@example.com'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('responses', () => {
    it('never includes the invitation token', async () => {
      const { service } = buildService({
        existingUser: { id: 'user-1', email: 'existing@example.com', role: 'member' },
      });

      const result = await service.acceptInvitation('token-abc', 'existing@example.com', {
        firstName: 'Ada',
        lastName: 'Lovelace',
      });

      expect(result.invitation).not.toHaveProperty('token');
    });
  });
});
