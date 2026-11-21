import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TenantMemberRole } from 'src/common/enums';

import { TenantMember } from '../entities/tenant-member.entity';
import { MemberProfileService } from './member-profile.service';

const TENANT_ID = 'tenant-1';

const buildTarget = (overrides: Record<string, unknown> = {}) => ({
  id: 'member-1',
  userId: 'user-1',
  tenantId: TENANT_ID,
  role: TenantMemberRole.MEMBER,
  isActive: true,
  ...overrides,
});

const actorOf = (role: TenantMemberRole) => ({ id: 'actor-member', role }) as never;

const buildService = (target = buildTarget(), ownerCount = 2) => {
  const manager = { update: jest.fn().mockResolvedValue(undefined) };
  const members = {
    withTenantLock: jest.fn((_tenantId: string, work: (m: unknown) => Promise<unknown>) =>
      work(manager),
    ),
    findLifecycleTarget: jest.fn().mockResolvedValue(target),
    countActiveOwners: jest.fn().mockResolvedValue(ownerCount),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const read = { getTenantMember: jest.fn().mockResolvedValue(target) };
  const activity = {
    snapshotOrgFields: jest.fn().mockResolvedValue({}),
    queueMemberActivity: jest.fn(),
    memberDisplayName: jest.fn().mockReturnValue('Ada'),
  };
  const orgAssignment = {
    updateMemberDepartment: jest.fn().mockResolvedValue(undefined),
    updateMemberReportsTo: jest.fn().mockResolvedValue(undefined),
  };
  const events = { emit: jest.fn() };
  const service = new MemberProfileService(
    members as never,
    {} as never,
    events as never,
    {} as never,
    read as never,
    activity as never,
    orgAssignment as never,
  );
  return { service, members, manager, orgAssignment };
};

const changeRole = (
  service: MemberProfileService,
  actor: TenantMemberRole,
  role: TenantMemberRole,
) => service.updateTenantMemberById('member-1', TENANT_ID, { role }, actorOf(actor));

describe('MemberProfileService role changes', () => {
  it('refuses an admin changing another admin', async () => {
    const { service, manager } = buildService(buildTarget({ role: TenantMemberRole.ADMIN }));

    await expect(
      changeRole(service, TenantMemberRole.ADMIN, TenantMemberRole.MEMBER),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('refuses an admin granting the admin role', async () => {
    const { service, manager } = buildService();

    await expect(
      changeRole(service, TenantMemberRole.ADMIN, TenantMemberRole.ADMIN),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('refuses a member changing roles', async () => {
    const { service, manager } = buildService();

    await expect(
      changeRole(service, TenantMemberRole.MEMBER, TenantMemberRole.MEMBER),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('lets an admin change a regular member to a non-privileged role', async () => {
    const { service, manager } = buildService();

    await changeRole(service, TenantMemberRole.ADMIN, TenantMemberRole.MEMBER);

    expect(manager.update).toHaveBeenCalledWith(TenantMember, 'member-1', {
      role: TenantMemberRole.MEMBER,
    });
  });

  it('lets an owner demote an admin to member', async () => {
    const { service, manager } = buildService(buildTarget({ role: TenantMemberRole.ADMIN }));

    await changeRole(service, TenantMemberRole.OWNER, TenantMemberRole.MEMBER);

    expect(manager.update).toHaveBeenCalledWith(TenantMember, 'member-1', {
      role: TenantMemberRole.MEMBER,
    });
  });

  it.each([TenantMemberRole.OWNER, TenantMemberRole.ADMIN])(
    'never changes the role of an owner, even for an %s actor',
    async (actorRole) => {
      const { service, manager } = buildService(buildTarget({ role: TenantMemberRole.OWNER }));

      await expect(changeRole(service, actorRole, TenantMemberRole.MEMBER)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(manager.update).not.toHaveBeenCalled();
    },
  );

  it.each([TenantMemberRole.OWNER, TenantMemberRole.ADMIN])(
    'never assigns the owner role through a member update, even for an %s actor',
    async (actorRole) => {
      const { service, manager } = buildService();

      await expect(changeRole(service, actorRole, TenantMemberRole.OWNER)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(manager.update).not.toHaveBeenCalled();
    },
  );

  it('leaves non-role org updates unlocked and unrestricted for an admin', async () => {
    const { service, members, orgAssignment } = buildService(
      buildTarget({ role: TenantMemberRole.OWNER }),
    );

    await service.updateTenantMemberById(
      'member-1',
      TENANT_ID,
      { departmentId: 'dep-1' },
      actorOf(TenantMemberRole.ADMIN),
    );

    expect(members.withTenantLock).not.toHaveBeenCalled();
    expect(orgAssignment.updateMemberDepartment).toHaveBeenCalledWith(
      TENANT_ID,
      'member-1',
      'dep-1',
    );
  });
});
