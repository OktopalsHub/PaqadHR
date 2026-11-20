import { ForbiddenException } from '@nestjs/common';
import { LeaveStatus } from 'src/common/enums';
import type { MemberContext } from 'src/common/interfaces';
import { ManagerAccessService } from 'src/common/services/manager-access.service';

import type { LeaveResponseDto } from './dto/leave-response.dto';
import type { UpdateLeaveDto } from './dto/update-leave.dto';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';
import type { LeaveDashboardService } from './services/leave-dashboard.service';

describe('LeaveController', () => {
  let controller: LeaveController;
  let leaveService: jest.Mocked<Pick<LeaveService, 'getLeave' | 'updateLeave' | 'deleteLeave'>>;
  let directReportIds: jest.Mock;
  let dashboardSummary: jest.Mock;

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
    directReportIds = jest.fn();
    dashboardSummary = jest.fn().mockResolvedValue({ pending: 0, onLeaveToday: 0, recent: [] });
    controller = new LeaveController(
      leaveService as unknown as LeaveService,
      { getDirectReportIds: directReportIds } as unknown as ManagerAccessService,
      { getSummary: dashboardSummary } as unknown as LeaveDashboardService,
    );
  });

  describe('getDashboardSummary', () => {
    const today = { today: '2026-11-20' };

    it('covers the whole workspace for an admin', async () => {
      await controller.getDashboardSummary('tenant-1', today, requester);

      expect(dashboardSummary).toHaveBeenCalledWith('tenant-1', undefined, '2026-11-20');
      expect(directReportIds).not.toHaveBeenCalled();
    });

    it('limits a manager to their direct reports', async () => {
      directReportIds.mockResolvedValue(['report-1', 'report-2']);
      const manager = { ...requester, role: 'member' } as MemberContext;

      await controller.getDashboardSummary('tenant-1', today, manager);

      expect(dashboardSummary).toHaveBeenCalledWith(
        'tenant-1',
        ['report-1', 'report-2'],
        '2026-11-20',
      );
    });

    it('limits a member without reports to their own leave', async () => {
      directReportIds.mockResolvedValue([]);
      const member = { ...requester, role: 'member' } as MemberContext;

      await controller.getDashboardSummary('tenant-1', today, member);

      expect(dashboardSummary).toHaveBeenCalledWith('tenant-1', [member.id], '2026-11-20');
    });
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
