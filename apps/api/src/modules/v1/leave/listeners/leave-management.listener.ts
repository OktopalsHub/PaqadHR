import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { LeaveBalanceInitializationService } from '../../leave-balance/leave-balance-initialization.service';
import { LeavePolicyService } from '../../leave-policy/leave-policy.service';
import { LeaveTypeService } from '../../leave-type/leave-type.service';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import type {
  LeaveTypeCreatedEvent,
  TenantCreatedEvent,
  TenantMemberCreatedEvent,
} from '../events/leave.events';

@Injectable()
export class LeaveManagementListener {
  private readonly logger = new Logger(LeaveManagementListener.name);
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
    } catch (error) {
      this.logger.error('Leave setup failed for tenant.created', error instanceof Error ? error.stack : undefined);
    }
  }
  @OnEvent('tenant.member.created')
  async handleTenantMemberCreated(event: TenantMemberCreatedEvent) {
    try {
      await this.leaveBalanceInitService.initializeLeaveBalancesForNewEmployee(
        event.tenantId,
        event.memberId,
        event.joinDate,
      );
    } catch (error) {
      this.logger.error('Leave setup failed for tenant.member.created', error instanceof Error ? error.stack : undefined);
    }
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
    } catch (error) {
      this.logger.error('Leave setup failed for leave.type.created', error instanceof Error ? error.stack : undefined);
    }
  }
}
