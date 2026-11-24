import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TenantMemberRole } from 'src/common/enums';
import { QueryFailedError } from 'typeorm';

import { TenantMember } from '../entities/tenant-member.entity';
import { MemberLifecycleService } from './member-lifecycle.service';

const TENANT_ID = 'tenant-1';
const ACTOR = { id: 'actor-member', role: TenantMemberRole.OWNER };

const buildTarget = (overrides: Record<string, unknown> = {}) => ({
  id: 'member-1',
  userId: 'user-1',
  tenantId: TENANT_ID,
  role: TenantMemberRole.MEMBER,
  isActive: true,
  leaveDate: null,
  firstName: 'Ada',
  lastName: 'Lovelace',
  ...overrides,
});

const buildService = (target: unknown = buildTarget(), ownerCount = 2) => {
  const manager = { update: jest.fn().mockResolvedValue(undefined) };
  const members = {
    withTenantLock: jest.fn((_tenantId: string, work: (m: unknown) => Promise<unknown>) =>
      work(manager),
    ),
    findLifecycleTarget: jest.fn().mockResolvedValue(target),
    countActiveOwners: jest.fn().mockResolvedValue(ownerCount),
    update: jest.fn().mockResolvedValue(undefined),
    save: jest.fn(),
    findMembershipByUserAndTenant: jest.fn().mockResolvedValue(null),
  };
  const counters = { nextValue: jest.fn().mockResolvedValue(7) };
  const settings = { findOne: jest.fn().mockResolvedValue(null) };
  const events = { emit: jest.fn() };
  const read = {
    getTenantMember: jest.fn().mockResolvedValue(target),
    getTenantMemberProfile: jest.fn().mockResolvedValue(target),
  };
  const activity = {
    emitActivity: jest.fn(),
    memberDisplayName: jest.fn().mockReturnValue('Ada Lovelace'),
  };
  const service = new MemberLifecycleService(
    members as never,
    counters as never,
    settings as never,
    events as never,
    read as never,
    activity as never,
  );
  return { service, manager, members, counters, settings, events, read, activity };
};

describe('MemberLifecycleService removal and status guards', () => {
  it('loads the member by member id and tenant, then deactivates it', async () => {
    const { service, members, manager } = buildService();

    await service.removeTenantMember('member-1', TENANT_ID, ACTOR);

    expect(members.findLifecycleTarget).toHaveBeenCalledWith('member-1', TENANT_ID, manager);
    expect(manager.update).toHaveBeenCalledWith(
      TenantMember,
      'member-1',
      expect.objectContaining({ isActive: false }),
    );
  });

  it('returns not found when the member is outside the tenant', async () => {
    const { service, manager } = buildService(null);

    await expect(service.removeTenantMember('member-1', TENANT_ID, ACTOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('refuses removing the last active owner', async () => {
    const { service, manager } = buildService(buildTarget({ role: TenantMemberRole.OWNER }), 1);

    await expect(service.removeTenantMember('member-1', TENANT_ID, ACTOR)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('refuses the last owner removing themselves', async () => {
    const owner = buildTarget({ id: ACTOR.id, role: TenantMemberRole.OWNER });
    const { service } = buildService(owner, 1);

    await expect(service.removeTenantMember(ACTOR.id, TENANT_ID, ACTOR)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('allows removing an owner when another owner remains', async () => {
    const { service, manager } = buildService(buildTarget({ role: TenantMemberRole.OWNER }), 2);

    await service.removeTenantMember('member-1', TENANT_ID, ACTOR);

    expect(manager.update).toHaveBeenCalled();
  });

  it.each([TenantMemberRole.ADMIN, TenantMemberRole.OWNER])(
    'refuses an admin acting on a %s',
    async (role) => {
      const { service, manager } = buildService(buildTarget({ role }), 3);
      const admin = { id: 'admin-member', role: TenantMemberRole.ADMIN };

      await expect(service.removeTenantMember('member-1', TENANT_ID, admin)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(
        service.updateTenantMemberStatus('member-1', TENANT_ID, false, admin),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(manager.update).not.toHaveBeenCalled();
    },
  );

  it('lets an admin act on a regular member', async () => {
    const { service, manager } = buildService();

    await service.removeTenantMember('member-1', TENANT_ID, {
      id: 'admin-member',
      role: TenantMemberRole.ADMIN,
    });

    expect(manager.update).toHaveBeenCalled();
  });

  it('refuses deactivating the last active owner through the status route', async () => {
    const { service, manager } = buildService(buildTarget({ role: TenantMemberRole.OWNER }), 1);

    await expect(
      service.updateTenantMemberStatus('member-1', TENANT_ID, false, ACTOR),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(manager.update).not.toHaveBeenCalled();
  });
});

describe('MemberLifecycleService owner serialisation', () => {
  const trackLock = (
    members: ReturnType<typeof buildService>['members'],
    manager: { update: jest.Mock },
  ) => {
    const state = { locked: false };
    members.withTenantLock.mockImplementation(async (_t, work) => {
      state.locked = true;
      try {
        return await work(manager);
      } finally {
        state.locked = false;
      }
    });
    const requireLock = (value: unknown) =>
      jest.fn().mockImplementation(async () => {
        if (!state.locked) throw new Error('read outside the tenant lock');
        return value;
      });
    return requireLock;
  };

  it.each(['remove', 'status'] as const)(
    'counts owners and deactivates inside one tenant lock on the %s route',
    async (route) => {
      const owner = buildTarget({ role: TenantMemberRole.OWNER });
      const { service, members, manager } = buildService(owner, 2);
      const requireLock = trackLock(members, manager);
      members.findLifecycleTarget = requireLock(owner);
      members.countActiveOwners = requireLock(2);

      if (route === 'remove') {
        await service.removeTenantMember('member-1', TENANT_ID, ACTOR);
      } else {
        await service.updateTenantMemberStatus('member-1', TENANT_ID, false, ACTOR);
      }

      expect(members.withTenantLock).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));
      expect(members.countActiveOwners).toHaveBeenCalled();
      expect(manager.update).toHaveBeenCalled();
    },
  );

  it.each(['remove', 'status'] as const)(
    'lets only one of two owners deactivate each other concurrently on the %s route',
    async (route) => {
      const owners = new Map([
        ['owner-a', true],
        ['owner-b', true],
      ]);
      const { service, members } = buildService();
      let tail: Promise<unknown> = Promise.resolve();
      members.findLifecycleTarget.mockImplementation(async (id: string) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return buildTarget({ id, role: TenantMemberRole.OWNER, isActive: owners.get(id) });
      });
      members.countActiveOwners.mockImplementation(
        async () => [...owners.values()].filter(Boolean).length,
      );
      const manager = {
        update: jest.fn(async (_e: unknown, id: string) => {
          owners.set(id, false);
        }),
      };
      members.withTenantLock.mockImplementation((_t, work) => {
        const run = tail.then(() => work(manager));
        tail = run.catch(() => undefined);
        return run;
      });
      const act = (id: string) =>
        route === 'remove'
          ? service.removeTenantMember(id, TENANT_ID, ACTOR)
          : service.updateTenantMemberStatus(id, TENANT_ID, false, ACTOR);

      const results = await Promise.allSettled([act('owner-a'), act('owner-b')]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect([...owners.values()].filter(Boolean)).toHaveLength(1);
    },
  );
});

describe('MemberLifecycleService member creation', () => {
  it('generates the employee number with one atomic counter call', async () => {
    const { service, counters } = buildService();

    const number = await service.getNextEmployeeNumber(TENANT_ID);

    expect(counters.nextValue).toHaveBeenCalledTimes(1);
    expect(number).toBe('007');
  });

  it('maps a unique violation to a generic conflict without leaking details', async () => {
    const { service, members } = buildService();
    members.save.mockRejectedValue(
      new QueryFailedError(
        'INSERT',
        [],
        Object.assign(new Error('secret@x.com dup'), { code: '23505' }),
      ),
    );

    const failure = service.createTenantMember('user-1', TENANT_ID, {
      firstName: 'A',
      lastName: 'B',
    } as never);

    await expect(failure).rejects.toBeInstanceOf(ConflictException);
    await expect(failure).rejects.not.toThrow(/secret/);
  });

  it('does not echo unknown error messages to the client', async () => {
    const { service, members } = buildService();
    members.save.mockRejectedValue(new Error('relation "x" does not exist'));

    await expect(
      service.createTenantMember('user-1', TENANT_ID, {
        firstName: 'A',
        lastName: 'B',
      } as never),
    ).rejects.not.toThrow(/relation/);
  });
});
