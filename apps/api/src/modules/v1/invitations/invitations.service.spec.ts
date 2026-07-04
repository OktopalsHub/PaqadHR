import { BadRequestException } from '@nestjs/common';
import { InvitationStatus } from '../../../common/enums';
import { InvitationsService } from './invitations.service';

describe('InvitationsService acceptInvitation', () => {
  const invitation = {
    id: 'inv-1',
    email: 'existing@example.com',
    tenantId: 'tenant-1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'member',
    status: InvitationStatus.PENDING,
    invitedBy: 'member-1',
    expiresAt: new Date(Date.now() + 86_400_000),
    token: 'token-abc',
  };

  function buildService(overrides?: {
    existingUser?: { id: string; email: string; role: string } | null;
  }) {
    const invitationsRepository = {
      findInvitationByToken: jest.fn().mockResolvedValue(invitation),
      acceptInvitation: jest.fn().mockResolvedValue({ ...invitation, status: InvitationStatus.ACCEPTED }),
      softDelete: jest.fn().mockResolvedValue(undefined),
    };
    const tenantMembersService = {
      checkUserTenantMembership: jest.fn().mockResolvedValue(null),
      createTenantMember: jest.fn().mockResolvedValue(undefined),
    };
    const usersService = {
      getUserByEmail: jest.fn().mockResolvedValue(overrides?.existingUser ?? null),
      createUser: jest.fn(),
      updateUser: jest.fn(),
    };
    const tenantsService = {
      getTenant: jest.fn().mockResolvedValue({ id: 'tenant-1', name: 'Acme', slug: 'acme' }),
    };
    const rateLimitService = {
      checkRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
      clearRateLimit: jest.fn(),
    };
    const zeptomailEmailService = { sendTemplateEmail: jest.fn() };
    const activitiesService = { queueActivity: jest.fn().mockResolvedValue(undefined) };

    const service = new InvitationsService(
      invitationsRepository as any,
      tenantMembersService as any,
      usersService as any,
      tenantsService as any,
      rateLimitService as any,
      zeptomailEmailService as any,
      activitiesService as any,
    );

    return {
      service,
      invitationsRepository,
      tenantMembersService,
      usersService,
      activitiesService,
    };
  }

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
      ...invitation,
      firstName: '',
      lastName: '',
    });

    await expect(
      service.acceptInvitation('token-abc', 'existing@example.com', {
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
