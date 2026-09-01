import { LeaveStatus } from 'src/common/enums';
import type { LeaveResponseDto } from './dto/leave-response.dto';
import { LeaveService } from './leave.service';

describe('LeaveService', () => {
  const tenantId = 'tenant-1';
  const leaveId = 'leave-1';
  const requesterId = 'member-1';
  const existingStartDate = new Date('2026-09-11T00:00:00.000Z');

  it('validates the existing duration against the new type when only leaveTypeId changes', async () => {
    const leaveRepository = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const service = new LeaveService(
      leaveRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const existingLeave = {
      id: leaveId,
      startDate: existingStartDate,
      endDate: new Date('2026-09-15T00:00:00.000Z'),
      duration: 3,
      status: LeaveStatus.PENDING,
      reason: 'Annual leave',
      leaveType: { id: 'leave-type-old', name: 'Annual', description: '' },
      requester: { id: requesterId },
    } as LeaveResponseDto;
    const checkLeaveBalance = jest
      .spyOn(service, 'checkLeaveBalance')
      .mockResolvedValue({} as never);

    jest.spyOn(service, 'getLeave').mockResolvedValue(existingLeave);

    await service.updateLeave(tenantId, leaveId, { leaveTypeId: 'leave-type-new' });

    expect(checkLeaveBalance).toHaveBeenCalledWith(
      tenantId,
      requesterId,
      'leave-type-new',
      existingLeave.duration,
      existingStartDate,
    );
    expect(leaveRepository.update).toHaveBeenCalledWith(
      { id: leaveId, tenantId, status: LeaveStatus.PENDING },
      { leaveTypeId: 'leave-type-new', duration: existingLeave.duration },
    );
  });
});
