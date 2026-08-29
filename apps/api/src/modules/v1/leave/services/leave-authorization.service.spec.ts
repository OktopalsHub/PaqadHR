import { ForbiddenException } from '@nestjs/common';
import { LeaveStatus } from 'src/common/enums';
import { LeaveAuthorizationService } from './leave-authorization.service';

describe('LeaveAuthorizationService', () => {
  const leaveService = {
    getLeave: jest.fn(),
    listLeavesByTenant: jest.fn(),
  };
  const managerAccessService = {
    assertAdminOrManagerOf: jest.fn(),
    getDirectReportIds: jest.fn(),
  };
  const service = new LeaveAuthorizationService(
    leaveService as never,
    managerAccessService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks self-approval', async () => {
    leaveService.getLeave.mockResolvedValue({
      id: 'leave-1',
      status: LeaveStatus.PENDING,
      requester: { id: 'member-1' },
    });

    await expect(
      service.assertCanApproveOrReject('tenant-1', { id: 'member-1', role: 'MEMBER', memberId: 'member-1' }, 'leave-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('requires manager access for non-admin approvers', async () => {
    leaveService.getLeave.mockResolvedValue({
      id: 'leave-1',
      status: LeaveStatus.PENDING,
      requester: { id: 'member-2' },
    });
    managerAccessService.assertAdminOrManagerOf.mockRejectedValue(
      new ForbiddenException('Admin or manager access required'),
    );

    await expect(
      service.assertCanApproveOrReject('tenant-1', { id: 'member-1', role: 'MEMBER', memberId: 'member-1' }, 'leave-1'),
    ).rejects.toThrow(ForbiddenException);
  });
});
