import { Injectable } from '@nestjs/common';
import { LeaveBalanceService } from '../../leave-balance/leave-balance.service';

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
}
