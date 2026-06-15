import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { LeaveBalanceInitializationService } from '../../leave-balance/leave-balance-initialization.service';
import type { LeavePolicyService } from '../../leave-policy/leave-policy.service';
import type { LeaveTypeService } from '../../leave-type/leave-type.service';
import type { TenantMembersService } from '../../tenant-members/tenant-members.service';
import type {
  LeaveTypeCreatedEvent,
  TenantCreatedEvent,
  TenantMemberCreatedEvent,
} from '../events/leave.events';

@Injectable()
export class LeaveManagementListener {
  constructor(
    private readonly leaveTypeService: LeaveTypeService,
    private readonly tenantMembersService: TenantMembersService,
    private readonly leaveBalanceInitService: LeaveBalanceInitializationService,
    private readonly leavePolicyService: LeavePolicyService,
  ) {}
  @OnEvent('tenant.created')
  async handleTenantCreated(event: TenantCreatedEvent) {
    try {
      await this.leavePolicyService.createDefaultPolicy(event.tenantId);
      await this.leaveTypeService.createLeaveType(event.tenantId, event.tenantMemberId, {
        name: 'PTO',
        description: 'Paid Time Off',
        defaultDays: 21,
      });
    } catch (_error) {}
  }
  @OnEvent('tenant.member.created')
  async handleTenantMemberCreated(event: TenantMemberCreatedEvent) {
    try {
      await this.leaveBalanceInitService.initializeLeaveBalancesForNewEmployee(
        event.tenantId,
        event.memberId,
        event.joinDate,
      );
    } catch (_error) {}
  }
  @OnEvent('leave.type.created')
  async handleLeaveTypeCreated(event: LeaveTypeCreatedEvent) {
    try {
      const activeMembers = await this.tenantMembersService.listActiveTenantMembers(event.tenantId);
      const memberIds = activeMembers.map((member) => member.id);
      await this.leaveBalanceInitService.initializeNewLeaveTypeForAllMembers(
        event.tenantId,
        event.leaveTypeId,
        event.defaultDays,
        memberIds,
      );
    } catch (_error) {}
  }
}
