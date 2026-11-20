import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { TenantMemberGuard } from './tenant-members.guards';

const tenant = { id: 't1', slug: 'acme', name: 'Acme', isActive: true };

function build() {
  const tenantRepository = { findOne: jest.fn().mockResolvedValue(tenant) };
  const members = {
    findUserTenantMembership: jest.fn().mockResolvedValue({ id: 'm1', role: 'ADMIN' }),
  };
  const guard = new TenantMemberGuard(members as never, tenantRepository as never, new Reflector());
  const contextFor = (request: Record<string, unknown>) =>
    ({
      getHandler: () => () => undefined,
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;
  return { guard, tenantRepository, members, contextFor };
}

describe('TenantMemberGuard', () => {
  it('reuses the lookup TenantGuard left on the request instead of querying again', async () => {
    const { guard, tenantRepository, members, contextFor } = build();
    const request: Record<string, unknown> = {
      params: { tenantId: 't1' },
      auth: { principalId: 'u1' },
      tenantAccess: { userId: 'u1', tenantId: 't1', memberId: 'm1', role: 'ADMIN', tenant },
    };
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(tenantRepository.findOne).not.toHaveBeenCalled();
    expect(members.findUserTenantMembership).not.toHaveBeenCalled();
    expect(request.member).toEqual({ id: 'm1', role: 'ADMIN', memberId: 'm1' });
  });

  it('queries when the earlier lookup is missing or belongs to another user or tenant', async () => {
    const { guard, tenantRepository, members, contextFor } = build();
    const stale = { userId: 'other', tenantId: 't1', memberId: 'mx', role: 'OWNER', tenant };
    await guard.canActivate(
      contextFor({ params: { tenantId: 't1' }, auth: { principalId: 'u1' }, tenantAccess: stale }),
    );
    expect(tenantRepository.findOne).toHaveBeenCalledTimes(1);
    expect(members.findUserTenantMembership).toHaveBeenCalledWith('u1', 't1');
  });
});
