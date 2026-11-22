import { ConflictException } from '@nestjs/common';
import { LeaveStatus } from 'src/common/enums';

import { LeaveApprovalService } from './leave-approval.service';

const leave = (status: LeaveStatus) => ({
  id: 'l1',
  tenantId: 't1',
  requestedBy: 'requester',
  status,
  duration: 3,
  startDate: '2099-01-01',
  endDate: '2099-01-03',
});

function build(affected: number) {
  const repo = {
    findOne: jest.fn().mockResolvedValue(leave(LeaveStatus.PENDING)),
    update: jest.fn().mockResolvedValue({ affected }),
  };
  const balances = { applyLeaveImpact: jest.fn() };
  const service = new LeaveApprovalService(
    repo as never,
    balances as never,
    { queueActivity: jest.fn() } as never,
    { sendLeaveRequestNotification: jest.fn().mockResolvedValue(undefined) } as never,
    { capture: jest.fn() } as never,
  );
  return { service, repo, balances };
}

describe('LeaveApprovalService', () => {
  it('claims a pending leave before applying the balance impact', async () => {
    const { service, repo, balances } = build(1);
    await service.approveLeave('t1', 'l1', 'approver');
    expect(repo.update).toHaveBeenCalledWith(
      { id: 'l1', tenantId: 't1', status: LeaveStatus.PENDING },
      expect.objectContaining({ status: LeaveStatus.APPROVED }),
    );
    expect(balances.applyLeaveImpact).toHaveBeenCalledTimes(1);
  });

  it('does not touch balances when the leave was already processed', async () => {
    const { service, balances } = build(0);
    await expect(service.rejectLeave('t1', 'l1', 'approver', 'no')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(balances.applyLeaveImpact).not.toHaveBeenCalled();
  });
});
