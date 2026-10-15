import { ForbiddenException } from '@nestjs/common';
import { LeaveStatus } from 'src/common/enums';
import type { MemberContext } from 'src/common/interfaces';
import { ManagerAccessService } from 'src/common/services/manager-access.service';
import type { LeaveResponseDto } from './dto/leave-response.dto';
import type { UpdateLeaveDto } from './dto/update-leave.dto';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';

describe('LeaveController', () => {
  let controller: LeaveController;
  let leaveService: jest.Mocked<Pick<LeaveService, 'getLeave' | 'updateLeave' | 'deleteLeave'>>;

  const requester: MemberContext = { id: 'member-1', memberId: 'member-1', role: 'admin' };
  const ownPendingLeave = {
    id: 'leave-1',
    status: LeaveStatus.PENDING,
    requester: { id: requester.id },
  } as LeaveResponseDto;

  beforeEach(() => {
    leaveService = {
      getLeave: jest.fn(),
      updateLeave: jest.fn(),
      deleteLeave: jest.fn(),
    };
    controller = new LeaveController(
      leaveService as unknown as LeaveService,
      {} as ManagerAccessService,
    );
  });

  it('allows a member to update their own pending leave request', async () => {
    leaveService.getLeave.mockResolvedValue(ownPendingLeave);

    await controller.updateLeave('tenant-1', ownPendingLeave.id, {} as UpdateLeaveDto, requester);

    expect(leaveService.updateLeave).toHaveBeenCalledWith('tenant-1', ownPendingLeave.id, {});
  });

  it('rejects edits to a non-pending request even when the requester is an admin', async () => {
    leaveService.getLeave.mockResolvedValue({
      ...ownPendingLeave,
      status: LeaveStatus.APPROVED,
    });

    await expect(
      controller.updateLeave('tenant-1', ownPendingLeave.id, {} as UpdateLeaveDto, requester),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(leaveService.updateLeave).not.toHaveBeenCalled();
  });

  it('rejects deletion of a non-pending request', async () => {
    leaveService.getLeave.mockResolvedValue({
      ...ownPendingLeave,
      status: LeaveStatus.CANCELLED,
    });

    await expect(
      controller.deleteLeave('tenant-1', ownPendingLeave.id, requester),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(leaveService.deleteLeave).not.toHaveBeenCalled();
  });
});
