import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { LeaveStatus } from 'src/common/enums';
import type { MemberContext } from 'src/common/interfaces';
import { ManagerAccessService } from 'src/common/services/manager-access.service';
import { isTenantAdmin } from 'src/common/utils/member-access.util';
import type { LeaveResponseDto } from '../dto/leave-response.dto';
import type { ListLeavesQueryDto } from '../dto/list-leaves-query.dto';
import { LeaveService } from '../leave.service';

export function toMemberContext(member: { id: string; role: string }): MemberContext {
  return { id: member.id, role: member.role, memberId: member.id };
}

@Injectable()
export class LeaveAuthorizationService {
  constructor(
    private readonly leaveService: LeaveService,
    private readonly managerAccessService: ManagerAccessService,
  ) {}

  async assertCanApproveOrReject(
    tenantId: string,
    member: MemberContext,
    leaveId: string,
  ): Promise<LeaveResponseDto> {
    const leave = await this.leaveService.getLeave(tenantId, leaveId);
    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Leave request is not pending');
    }
    if (leave.requester?.id === member.id) {
      throw new ForbiddenException('You cannot approve your own leave request');
    }
    if (leave.requester?.id) {
      await this.managerAccessService.assertAdminOrManagerOf(
        member,
        leave.requester.id,
        tenantId,
      );
    } else {
      throw new ForbiddenException('Admin or manager access required');
    }
    return leave;
  }

  async listPendingLeavesForApprover(
    tenantId: string,
    member: MemberContext,
    pagination: Pick<ListLeavesQueryDto, 'page' | 'limit'>,
    filters: { status?: LeaveStatus; from?: string; to?: string } = {},
  ) {
    const { status, from, to } = filters;
    if (isTenantAdmin(member)) {
      return this.leaveService.listLeavesByTenant(tenantId, pagination, { status, from, to });
    }
    const directReports = await this.managerAccessService.getDirectReportIds(tenantId, member.id);
    if (directReports.length === 0) {
      throw new ForbiddenException('Admin or manager access required');
    }
    return this.leaveService.listLeavesByTenant(tenantId, pagination, {
      status,
      from,
      to,
      requesterIds: directReports,
    });
  }
}
