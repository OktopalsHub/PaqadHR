import { Injectable } from '@nestjs/common';
import { LeavePolicyService } from '../leave-policy/leave-policy.service';
import type { LeaveBalance } from './entities/leave-balance.entity';
import { LeaveBalanceRepository } from './leave-balance.repository';

@Injectable()
export class LeaveBalanceCalcService {
  constructor(
    private readonly leaveBalanceRepository: LeaveBalanceRepository,
    private readonly leavePolicyService: LeavePolicyService,
  ) {}

  async calculateCarryoverDays(
    tenantId: string,
    memberId: string,
    leaveTypeId: string,
    previousYear: number,
  ): Promise<{ carryoverDays: number; expiryDate: Date | null }> {
    const tenantPolicy = await this.leavePolicyService.getTenantPolicy(tenantId);
    if (!tenantPolicy?.allowCarryover) {
      return { carryoverDays: 0, expiryDate: null };
    }
    const previousBalance = await this.leaveBalanceRepository.findByCriteria({
      tenantId,
      memberId,
      leaveTypeId,
      year: previousYear,
    });
    if (!previousBalance || previousBalance.remainingDays <= 0) {
      return { carryoverDays: 0, expiryDate: null };
    }
    const carryoverDays = Math.min(previousBalance.remainingDays, tenantPolicy.maxCarryoverDays);
    let expiryDate: Date | null = null;
    if (tenantPolicy.carryoverExpiryMonths && tenantPolicy.carryoverExpiryMonths > 0) {
      expiryDate = new Date();
      expiryDate.setFullYear(previousYear + 1);
      expiryDate.setMonth(expiryDate.getMonth() + tenantPolicy.carryoverExpiryMonths);
    }
    return { carryoverDays, expiryDate };
  }

  getAvailableCarryoverDays(balance: LeaveBalance, currentDate: Date): number {
    if (balance.carryoverDays === 0) return 0;
    if (balance.carryoverExpiryDate && currentDate > balance.carryoverExpiryDate) {
      return 0;
    }
    return Math.max(0, balance.carryoverDays - balance.carryoverUsed);
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

  async getOrganizationBalanceStats(tenantId: string, year?: number) {
    const currentYear = year || new Date().getFullYear();
    return this.leaveBalanceRepository.getBalanceStatsByTenant(tenantId, currentYear);
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
