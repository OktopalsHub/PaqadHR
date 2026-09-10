import { LeaveStatus } from 'src/common/enums';
import { LeaveService } from './leave.service';

describe('LeaveService', () => {
  const tenantId = 'tenant-1';
  const leaveId = 'leave-1';
  const requesterId = 'member-1';
  const existingStartDate = new Date('2026-09-11T00:00:00.000Z');

  it('validates the existing duration against the new type when only leaveTypeId changes', async () => {
    const existingEntity = {
      id: leaveId,
      tenantId,
      startDate: existingStartDate,
      endDate: new Date('2026-09-15T00:00:00.000Z'),
      duration: 3,
      status: LeaveStatus.PENDING,
      reason: 'Annual leave',
      leaveTypeId: 'leave-type-old',
      requestedBy: requesterId,
      leaveTypes: { id: 'leave-type-old', name: 'Annual', description: '' },
      requester: { id: requesterId },
    };
    const leaveRepository = {
      findOne: jest.fn().mockResolvedValue(existingEntity),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const leaveBalanceUpdateService = {
      releaseAndReserve: jest.fn().mockResolvedValue(undefined),
      adjustPendingOrApprovedDuration: jest.fn().mockResolvedValue(undefined),
    };
    const service = new LeaveService(
      leaveRepository as never,
      {} as never,
      {} as never,
      leaveBalanceUpdateService as never,
      {} as never,
    );
    const checkLeaveBalance = jest
      .spyOn(service, 'checkLeaveBalance')
      .mockResolvedValue({} as never);

    await service.updateLeave(tenantId, leaveId, { leaveTypeId: 'leave-type-new' });

    expect(checkLeaveBalance).toHaveBeenCalledWith(
      tenantId,
      requesterId,
      'leave-type-new',
      existingEntity.duration,
      existingStartDate,
      0,
    );
    expect(leaveRepository.update).toHaveBeenCalledWith(
      { id: leaveId, tenantId, status: LeaveStatus.PENDING },
      { leaveTypeId: 'leave-type-new', duration: existingEntity.duration },
    );
    expect(leaveBalanceUpdateService.releaseAndReserve).toHaveBeenCalled();
  });
});
