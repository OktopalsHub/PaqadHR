import { toTenantActivityListItem } from './tenant-activity-list-item.dto';

describe('toTenantActivityListItem', () => {
  it('omits payment provider fields from tenant-facing metadata', () => {
    const item = toTenantActivityListItem({
      id: 'a1',
      tenantId: 'tenant-1',
      actorMemberId: null,
      action: 'payroll.payment_sent',
      resourceType: 'payroll',
      resourceId: 'run-1',
      description: 'Payment sent to employee',
      status: 'SUCCESS',
      severity: 'LOW',
      metadata: {
        provider: 'Nomba',
        paymentProvider: 'Nomba',
        amount: 5000,
      },
      createdAt: new Date('2026-01-01'),
      actorMember: null,
    } as any);

    expect(item.metadata).toEqual({ amount: 5000 });
  });
});
