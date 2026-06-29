import { Injectable } from '@nestjs/common';
import type {
  AssignmentResult,
  AssignmentToAllUsersResult,
  MissingAssignment,
  MissingLeaveType,
  RemovalResult,
} from 'src/common/interfaces';
import { LeaveTypeService } from '../leave-type/leave-type.service';
import { TenantMembersService } from '../tenant-members/tenant-members.service';
import { LeaveBalanceService } from './leave-balance.service';

@Injectable()
export class LeaveTypeAssignmentService {
  constructor(
    private readonly leaveTypeService: LeaveTypeService,
    private readonly tenantMemberService: TenantMembersService,
    private readonly leaveBalanceService: LeaveBalanceService,
  ) {}
  async assignExistingLeaveTypesToUsers(tenantId: string, year?: number) {
    const currentYear = year || new Date().getFullYear();
    const leaveTypes = await this.leaveTypeService.listLeaveTypes(tenantId);
    const activeLeaveTypes = leaveTypes.filter((lt) => lt.isActive);
    const members = await this.tenantMemberService.listActiveTenantMembers(tenantId);
    const assignments: AssignmentResult[] = [];
    for (const member of members) {
      for (const leaveType of activeLeaveTypes) {
        const existingBalance = await this.leaveBalanceService.findByCriteria({
          tenantId,
          memberId: member.id,
          leaveTypeId: leaveType.id,
          year: currentYear,
        });
        if (!existingBalance) {
          const balance = await this.leaveBalanceService.createLeaveBalance(
            tenantId,
            member.id,
            leaveType.id,
            {
              year: currentYear,
              totalDays: leaveType.defaultDays,
              usedDays: 0,
              remainingDays: leaveType.defaultDays,
            },
          );
          assignments.push({
            memberId: member.id,
            leaveTypeId: leaveType.id,
            leaveTypeName: leaveType.name,
            allocatedDays: leaveType.defaultDays,
            balanceId: balance.id,
          });
        }
      }
    }
    return {
      tenantId,
      year: currentYear,
      totalAssignments: assignments.length,
      assignments,
    };
  }
  async assignLeaveTypeToAllUsers(tenantId: string, leaveTypeId: string, year?: number) {
    const currentYear = year || new Date().getFullYear();
    const leaveType = await this.leaveTypeService.getLeaveType(tenantId, leaveTypeId);
    const members = await this.tenantMemberService.listActiveTenantMembers(tenantId);
    const assignments: AssignmentToAllUsersResult[] = [];
    for (const member of members) {
      const existingBalance = await this.leaveBalanceService.findByCriteria({
        tenantId,
        memberId: member.id,
        leaveTypeId,
        year: currentYear,
      });
      if (!existingBalance) {
        const balance = await this.leaveBalanceService.createLeaveBalance(
          tenantId,
          member.id,
          leaveTypeId,
          {
            year: currentYear,
            totalDays: leaveType.defaultDays,
            usedDays: 0,
            remainingDays: leaveType.defaultDays,
          },
        );
        assignments.push({
          memberId: member.id,
          balanceId: balance.id,
          allocatedDays: leaveType.defaultDays,
        });
      }
    }
    return {
      leaveTypeId,
      leaveTypeName: leaveType.name,
      totalAssignments: assignments.length,
      assignments,
    };
  }
  async removeLeaveTypeAssignments(tenantId: string, leaveTypeId: string, year?: number) {
    const currentYear = year || new Date().getFullYear();
    const balances = await this.leaveBalanceService.getBalancesByMember(tenantId, '', currentYear);
    const targetBalances = balances.filter((b) => b.leaveTypeId === leaveTypeId);
    const removals: RemovalResult[] = [];
    for (const balance of targetBalances) {
      if (balance.usedDays === 0) {
        await this.leaveBalanceService.deleteLeaveBalance(tenantId, balance.id);
        removals.push({
          memberId: balance.memberId,
          balanceId: balance.id,
          removedDays: balance.totalDays,
        });
      }
    }
    return {
      leaveTypeId,
      totalRemovals: removals.length,
      removals,
      balancesWithUsedDays: targetBalances.filter((b) => b.usedDays > 0).length,
    };
  }
  async syncAllLeaveTypeAssignments(tenantId: string, year?: number) {
    const currentYear = year || new Date().getFullYear();
    const result = await this.assignExistingLeaveTypesToUsers(tenantId, currentYear);
    return {
      message: 'Leave type assignments synced successfully',
      ...result,
    };
  }
  async getAssignmentReport(tenantId: string, year?: number) {
    const currentYear = year || new Date().getFullYear();
    const leaveTypes = await this.leaveTypeService.listLeaveTypes(tenantId);
    const activeLeaveTypes = leaveTypes.filter((lt) => lt.isActive);
    const members = await this.tenantMemberService.listActiveTenantMembers(tenantId);
    const report = {
      tenantId,
      year: currentYear,
      totalLeaveTypes: activeLeaveTypes.length,
      totalMembers: members.length,
      missingAssignments: [] as MissingAssignment[],
      completeAssignments: 0,
    };
    for (const member of members) {
      const memberMissingTypes: MissingLeaveType[] = [];
      for (const leaveType of activeLeaveTypes) {
        const balance = await this.leaveBalanceService.findByCriteria({
          tenantId,
          memberId: member.id,
          leaveTypeId: leaveType.id,
          year: currentYear,
        });
        if (!balance) {
          memberMissingTypes.push({
            leaveTypeId: leaveType.id,
            leaveTypeName: leaveType.name,
            defaultDays: leaveType.defaultDays,
          });
        }
      }
      if (memberMissingTypes.length > 0) {
        report.missingAssignments.push({
          memberId: member.id,
          memberName: `${member.firstName} ${member.lastName}`.trim(),
          missingTypes: memberMissingTypes,
        });
      } else {
        report.completeAssignments++;
      }
    }
    return report;
  }
}
