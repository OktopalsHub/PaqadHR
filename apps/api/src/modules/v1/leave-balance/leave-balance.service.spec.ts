import { LeaveBalanceRepository } from './leave-balance.repository';
import { LeaveBalanceService } from './leave-balance.service';

describe('LeaveBalanceService listLeaveBalances', () => {
  it('maps member and leave-type labels without exposing raw UUID fallbacks', async () => {
    const repository = {
      findAdminListWithLabels: jest.fn().mockResolvedValue([
        {
          id: 'bal-1',
          memberId: 'member-uuid',
          leaveTypeId: 'type-uuid',
          totalDays: 20,
          usedDays: 5,
          remainingDays: 15,
          carryoverDays: 0,
          regularDays: 20,
          carryoverUsed: 0,
          year: 2026,
          tenantId: 'tenant-1',
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-02'),
          leaveTypeName: 'Annual Leave',
          memberPreferredName: 'Ada',
          memberFirstName: 'Adaobi',
          memberLastName: 'Okafor',
        },
        {
          id: 'bal-2',
          memberId: 'member-uuid-2',
          leaveTypeId: 'type-uuid-2',
          totalDays: 5,
          usedDays: 0,
          remainingDays: 5,
          carryoverDays: 0,
          regularDays: 5,
          carryoverUsed: 0,
          year: 2026,
          tenantId: 'tenant-1',
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-02'),
          leaveTypeName: null,
          memberPreferredName: null,
          memberFirstName: null,
          memberLastName: null,
        },
      ]),
    };

    const service = new LeaveBalanceService(
      repository as unknown as LeaveBalanceRepository,
      {} as never,
      { queueActivity: jest.fn().mockResolvedValue(undefined) } as never,
      { sendLeaveBalanceUpdatedNotification: jest.fn().mockResolvedValue(undefined) } as never,
    );

    const rows = await service.listLeaveBalances('tenant-1');
    expect(repository.findAdminListWithLabels).toHaveBeenCalledWith('tenant-1', undefined);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        memberName: 'Adaobi Okafor',
        leaveTypeName: 'Annual Leave',
      }),
    );
    expect(rows[1]).toEqual(
      expect.objectContaining({
        memberName: null,
        leaveTypeName: null,
      }),
    );
  });

  it('passes manager member scope into the repository query', async () => {
    const repository = {
      findAdminListWithLabels: jest.fn().mockResolvedValue([]),
    };
    const service = new LeaveBalanceService(
      repository as unknown as LeaveBalanceRepository,
      {} as never,
      { queueActivity: jest.fn().mockResolvedValue(undefined) } as never,
      { sendLeaveBalanceUpdatedNotification: jest.fn().mockResolvedValue(undefined) } as never,
    );

    await service.listLeaveBalances('tenant-1', ['m1', 'm2']);
    expect(repository.findAdminListWithLabels).toHaveBeenCalledWith('tenant-1', ['m1', 'm2']);
  });
});
