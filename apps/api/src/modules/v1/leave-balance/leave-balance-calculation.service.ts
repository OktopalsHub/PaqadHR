import { Injectable, NotFoundException } from '@nestjs/common';
import { LeaveStatus } from 'src/common/enums';
import type { Leave } from '../leave/entities/leave.entity';
import { LeavePolicyService } from '../leave-policy/leave-policy.service';
import type { LeaveBalance } from './entities/leave-balance.entity';
import { LeaveBalanceRepository } from './leave-balance.repository';

@Injectable()
export class LeaveBalanceCalculationService {
  constructor(
    private readonly leaveBalanceRepository: LeaveBalanceRepository,
    readonly _leavePolicyService: LeavePolicyService,
  ) {}

  async applyLeaveImpact(leave: Leave, previousStatus: LeaveStatus) {
    const balance = await this.leaveBalanceRepository.findByCriteria({
      tenantId: leave.tenantId,
      memberId: leave.requestedBy,
      leaveTypeId: leave.leaveTypeId,
      year: new Date(leave.startDate).getFullYear(),
    });
    if (!balance) {
      throw new NotFoundException('Leave balance not found');
    }
    let usedDaysChange = 0;
    if (previousStatus === LeaveStatus.PENDING && leave.status === LeaveStatus.APPROVED) {
      usedDaysChange = leave.duration;
    } else if (previousStatus === LeaveStatus.APPROVED && leave.status === LeaveStatus.REJECTED) {
      usedDaysChange = -leave.duration;
    } else if (previousStatus === LeaveStatus.APPROVED && leave.status === LeaveStatus.CANCELLED) {
      usedDaysChange = -leave.duration;
    } else if (previousStatus === LeaveStatus.PENDING && leave.status === LeaveStatus.REJECTED) {
      usedDaysChange = 0;
    }
    if (usedDaysChange !== 0) {
      const newUsedDays = balance.usedDays + usedDaysChange;
      const newRemainingDays = balance.totalDays - newUsedDays;
      await this.leaveBalanceRepository.update(balance.id, {
        usedDays: newUsedDays,
        remainingDays: newRemainingDays,
      });
    }
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
    if (leaveStatus !== LeaveStatus.APPROVED) {
      return;
    }
    const balance = await this.leaveBalanceRepository.findByCriteria({
      tenantId,
      memberId,
      leaveTypeId,
      year,
    });
    if (!balance) {
      throw new NotFoundException('Leave balance not found');
    }
    const durationDifference = newDuration - oldDuration;
    const newUsedDays = balance.usedDays + durationDifference;
    const newRemainingDays = balance.totalDays - newUsedDays;
    await this.leaveBalanceRepository.update(balance.id, {
      usedDays: newUsedDays,
      remainingDays: newRemainingDays,
    });
  }

  async hasInsufficientBalance(
    tenantId: string,
    memberId: string,
    leaveTypeId: string,
    requestedDays: number,
    year: number,
  ): Promise<boolean> {
    const balance = await this.leaveBalanceRepository.findByCriteria({
      tenantId,
      memberId,
      leaveTypeId,
      year,
    });
    return !balance || balance.remainingDays < requestedDays;
  }

  async getBalanceSummary(tenantId: string, memberId: string, year?: number) {
    const currentYear = year || new Date().getFullYear();
    const balances = await this.leaveBalanceRepository.find({
      where: { tenantId, memberId, year: currentYear },
      relations: ['leaveType'],
    });
    return balances.map((balance) => ({
      leaveTypeId: balance.leaveTypeId,
      leaveTypeName: balance.leaveType?.name,
      totalDays: balance.totalDays,
      usedDays: balance.usedDays,
      remainingDays: balance.remainingDays,
      utilizationPercentage:
        balance.totalDays > 0 ? Math.round((balance.usedDays / balance.totalDays) * 100) : 0,
    }));
  }

  async getOrganizationBalanceStats(tenantId: string, year?: number) {
    const currentYear = year || new Date().getFullYear();
    return this.leaveBalanceRepository.getBalanceStatsByTenant(tenantId, currentYear);
  }

  private getAvailableCarryoverDays(balance: LeaveBalance, currentDate: Date): number {
    if (balance.carryoverDays === 0) return 0;
    if (balance.carryoverExpiryDate && currentDate > balance.carryoverExpiryDate) {
      return 0;
    }
    return Math.max(0, balance.carryoverDays - balance.carryoverUsed);
  }

  async applyLeaveUsage(balanceId: string, daysToUse: number, leaveDate: Date) {
    const balance = await this.leaveBalanceRepository.findOne({
      where: { id: balanceId },
    });
    if (!balance) {
      throw new NotFoundException('Leave balance not found');
    }
    const availableCarryover = this.getAvailableCarryoverDays(balance, leaveDate);
    let carryoverUsed = 0;
    let _regularUsed = 0;
    if (availableCarryover > 0) {
      carryoverUsed = Math.min(daysToUse, availableCarryover);
      _regularUsed = Math.max(0, daysToUse - carryoverUsed);
    } else {
      _regularUsed = daysToUse;
    }
    const newCarryoverUsed = balance.carryoverUsed + carryoverUsed;
    const newUsedDays = balance.usedDays + daysToUse;
    const newRemainingDays = balance.totalDays - newUsedDays;
    await this.leaveBalanceRepository.update(balanceId, {
      usedDays: newUsedDays,
      remainingDays: newRemainingDays,
      carryoverUsed: newCarryoverUsed,
    });
    return this.leaveBalanceRepository.findOne({ where: { id: balanceId } });
  }

  async getDetailedBalance(tenantId: string, memberId: string, leaveTypeId: string, year: number) {
    const balance = await this.leaveBalanceRepository.findByCriteria({
      tenantId,
      memberId,
      leaveTypeId,
      year,
    });
    if (!balance) return null;
    const currentDate = new Date();
    const availableCarryover = this.getAvailableCarryoverDays(balance, currentDate);
    const expiredCarryover = balance.carryoverDays - balance.carryoverUsed - availableCarryover;
    return {
      ...balance,
      availableCarryover,
      expiredCarryover,
      availableRegularDays: balance.remainingDays - availableCarryover,
      isCarryoverExpired: balance.carryoverExpiryDate
        ? currentDate > balance.carryoverExpiryDate
        : false,
    };
  }
}
