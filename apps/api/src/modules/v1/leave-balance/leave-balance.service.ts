import { Injectable } from '@nestjs/common';
import { LeaveStatus } from 'src/common/enums';
import type { Leave } from '../leave/entities/leave.entity';
import type { CreateLeaveBalanceDto } from './dto/create-leave-balance.dto';
import type { UpdateLeaveBalanceDto } from './dto/update-leave-balance.dto';
import type { LeaveBalance } from './entities/leave-balance.entity';
import { LeaveBalanceCalculationService } from './leave-balance-calculation.service';
import { LeaveBalanceCarryoverService } from './leave-balance-carryover.service';
import { LeaveBalanceCrudService } from './leave-balance-crud.service';

@Injectable()
export class LeaveBalanceService {
  constructor(
    private readonly leaveBalanceCrudService: LeaveBalanceCrudService,
    private readonly leaveBalanceCalculationService: LeaveBalanceCalculationService,
    private readonly leaveBalanceCarryoverService: LeaveBalanceCarryoverService,
  ) {}

  async createLeaveBalance(
    tenantId: string,
    memberId: string,
    leaveTypeId: string,
    dto: CreateLeaveBalanceDto,
    actorMemberId?: string,
  ): Promise<LeaveBalance> {
    return this.leaveBalanceCrudService.createLeaveBalance(
      tenantId,
      memberId,
      leaveTypeId,
      dto,
      actorMemberId,
    );
  }

  async listLeaveBalances(tenantId: string, memberIds?: string[]) {
    return this.leaveBalanceCrudService.listLeaveBalances(tenantId, memberIds);
  }

  async getLeaveBalance(balanceId: string, tenantId: string) {
    return this.leaveBalanceCrudService.getLeaveBalance(balanceId, tenantId);
  }

  async updateLeaveBalance(
    balanceId: string,
    dto: UpdateLeaveBalanceDto,
    tenantId: string,
    actorMemberId?: string,
  ) {
    return this.leaveBalanceCrudService.updateLeaveBalance(balanceId, dto, tenantId, actorMemberId);
  }

  async deleteLeaveBalance(tenantId: string, balanceId: string, actorMemberId?: string) {
    return this.leaveBalanceCrudService.deleteLeaveBalance(tenantId, balanceId, actorMemberId);
  }

  async findByCriteria(criteria: {
    tenantId: string;
    memberId: string;
    leaveTypeId: string;
    year: number;
  }) {
    return this.leaveBalanceCrudService.findByCriteria(criteria);
  }

  async getBalancesByMember(tenantId: string, memberId: string, year: number) {
    return this.leaveBalanceCrudService.getBalancesByMember(tenantId, memberId, year);
  }

  async applyLeaveImpact(leave: Leave, previousStatus: LeaveStatus) {
    return this.leaveBalanceCalculationService.applyLeaveImpact(leave, previousStatus);
  }

  async updateBalanceForModifiedLeave(
    tenantId: string,
    memberId: string,
    leaveTypeId: string,
    year: number,
    oldDuration: number,
    newDuration: number,
    leaveStatus: LeaveStatus,
  ) {
    return this.leaveBalanceCalculationService.updateBalanceForModifiedLeave(
      tenantId,
      memberId,
      leaveTypeId,
      year,
      oldDuration,
      newDuration,
      leaveStatus,
    );
  }

  async getBalanceSummary(tenantId: string, memberId: string, year?: number) {
    return this.leaveBalanceCalculationService.getBalanceSummary(tenantId, memberId, year);
  }

  async hasInsufficientBalance(
    tenantId: string,
    memberId: string,
    leaveTypeId: string,
    requestedDays: number,
    year: number,
  ): Promise<boolean> {
    return this.leaveBalanceCalculationService.hasInsufficientBalance(
      tenantId,
      memberId,
      leaveTypeId,
      requestedDays,
      year,
    );
  }

  async getOrganizationBalanceStats(tenantId: string, year?: number) {
    return this.leaveBalanceCalculationService.getOrganizationBalanceStats(tenantId, year);
  }

  async resetBalancesForNewYear(
    tenantId: string,
    fromYear: number,
    toYear: number,
    allowCarryover: boolean = false,
    maxCarryoverDays: number = 0,
  ) {
    return this.leaveBalanceCarryoverService.resetBalancesForNewYear(
      tenantId,
      fromYear,
      toYear,
      allowCarryover,
      maxCarryoverDays,
    );
  }

  async bulkUpdateBalances(
    updates: Array<{
      balanceId: string;
      totalDays?: number;
      usedDays?: number;
      remainingDays?: number;
    }>,
  ) {
    return this.leaveBalanceCrudService.bulkUpdateBalances(updates);
  }

  async createLeaveBalanceWithCarryover(
    tenantId: string,
    memberId: string,
    leaveTypeId: string,
    dto: {
      year: number;
      regularDays: number;
      carryoverDays?: number;
      carryoverExpiryDate?: Date | null;
    },
  ): Promise<LeaveBalance> {
    return this.leaveBalanceCarryoverService.createLeaveBalanceWithCarryover(
      tenantId,
      memberId,
      leaveTypeId,
      dto,
    );
  }

  async applyLeaveUsage(balanceId: string, daysToUse: number, leaveDate: Date) {
    return this.leaveBalanceCalculationService.applyLeaveUsage(balanceId, daysToUse, leaveDate);
  }

  async expireCarryoverDays(tenantId: string, year: number) {
    return this.leaveBalanceCarryoverService.expireCarryoverDays(tenantId, year);
  }

  async getDetailedBalance(tenantId: string, memberId: string, leaveTypeId: string, year: number) {
    return this.leaveBalanceCalculationService.getDetailedBalance(
      tenantId,
      memberId,
      leaveTypeId,
      year,
    );
  }

  async bulkExpireCarryoverDays() {
    return this.leaveBalanceCarryoverService.bulkExpireCarryoverDays();
  }

  async initializeYearWithCarryover(
    tenantId: string,
    memberId: string,
    leaveTypeId: string,
    newYear: number,
    regularDaysAllocation: number,
  ) {
    return this.leaveBalanceCarryoverService.initializeYearWithCarryover(
      tenantId,
      memberId,
      leaveTypeId,
      newYear,
      regularDaysAllocation,
    );
  }
}
