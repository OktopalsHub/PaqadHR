import { Injectable } from '@nestjs/common';
import { LeaveStatus } from 'src/common/enums';
import { LeaveBalanceService } from '../../leave-balance/leave-balance.service';
import type { Leave } from '../entities/leave.entity';

@Injectable()
export class LeaveBalanceUpdateService {
  constructor(private readonly leaveBalanceService: LeaveBalanceService) {}

  async getLeaveBalanceForMember(tenantId: string, memberId: string, year?: number) {
    const currentYear = year || new Date().getFullYear();
    return this.leaveBalanceService.getBalancesByMember(tenantId, memberId, currentYear);
  }

  async getLeaveBalanceForMemberByType(
    tenantId: string,
    memberId: string,
    leaveTypeId: string,
    year?: number,
  ) {
    const currentYear = year || new Date().getFullYear();
    return this.leaveBalanceService.findByCriteria({
      tenantId,
      memberId,
      leaveTypeId,
      year: currentYear,
    });
  }

  async adjustPendingOrApprovedDuration(
    tenantId: string,
    memberId: string,
    leaveTypeId: string,
    year: number,
    oldDuration: number,
    newDuration: number,
    leaveStatus: LeaveStatus,
  ) {
    return this.leaveBalanceService.updateBalanceForModifiedLeave(
      tenantId,
      memberId,
      leaveTypeId,
      year,
      oldDuration,
      newDuration,
      leaveStatus,
    );
  }

  async releaseAndReserve(
    tenantId: string,
    existing: Leave,
    nextLeaveTypeId: string,
    nextStartDate: Date,
    nextDuration: number,
  ) {
    await this.leaveBalanceService.applyLeaveImpact(
      { ...existing, status: LeaveStatus.CANCELLED } as Leave,
      LeaveStatus.PENDING,
    );
    await this.leaveBalanceService.applyLeaveImpact(
      {
        ...existing,
        leaveTypeId: nextLeaveTypeId,
        startDate: nextStartDate,
        duration: nextDuration,
        status: LeaveStatus.PENDING,
      } as Leave,
      null,
    );
  }
}
