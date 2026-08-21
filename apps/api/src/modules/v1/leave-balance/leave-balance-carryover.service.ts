import { Injectable } from '@nestjs/common';
import type { CarryoverExpirationResult } from 'src/common/interfaces';
import { LeavePolicyService } from '../leave-policy/leave-policy.service';
import type { LeaveBalance } from './entities/leave-balance.entity';
import { LeaveBalanceRepository } from './leave-balance.repository';

@Injectable()
export class LeaveBalanceCarryoverService {
  constructor(
    private readonly leaveBalanceRepository: LeaveBalanceRepository,
    private readonly leavePolicyService: LeavePolicyService,
  ) {}

  private async calculateCarryoverDays(
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
    const totalDays = dto.regularDays + (dto.carryoverDays || 0);
    return this.leaveBalanceRepository.create({
      tenantId,
      memberId,
      leaveTypeId,
      year: dto.year,
      totalDays,
      regularDays: dto.regularDays,
      carryoverDays: dto.carryoverDays || 0,
      carryoverExpiryDate: dto.carryoverExpiryDate || null,
      usedDays: 0,
      remainingDays: totalDays,
      carryoverUsed: 0,
    });
  }

  async expireCarryoverDays(tenantId: string, year: number) {
    const tenantPolicy = await this.leavePolicyService.getTenantPolicy(tenantId);
    if (!tenantPolicy?.carryoverExpiryMonths) {
      return { expiredBalances: 0, totalExpiredDays: 0 };
    }
    const currentDate = new Date();
    const balancesToExpire = await this.leaveBalanceRepository.find({
      where: { tenantId, year },
    });
    let expiredBalances = 0;
    let totalExpiredDays = 0;
    for (const balance of balancesToExpire) {
      if (balance.carryoverExpiryDate && currentDate > balance.carryoverExpiryDate) {
        const unusedCarryover = balance.carryoverDays - balance.carryoverUsed;
        if (unusedCarryover > 0) {
          const newTotalDays = balance.totalDays - unusedCarryover;
          const newRemainingDays = Math.max(0, balance.remainingDays - unusedCarryover);
          await this.leaveBalanceRepository.update(balance.id, {
            totalDays: newTotalDays,
            remainingDays: newRemainingDays,
            carryoverDays: balance.carryoverUsed,
            carryoverExpiryDate: null,
          });
          expiredBalances++;
          totalExpiredDays += unusedCarryover;
        }
      }
    }
    return { expiredBalances, totalExpiredDays };
  }

  async bulkExpireCarryoverDays() {
    const currentYear = new Date().getFullYear();
    const tenantsWithCarryover = await this.leavePolicyService.getTenantIdsWithCarryoverPolicy();
    const results: CarryoverExpirationResult[] = [];
    for (const tenantId of tenantsWithCarryover) {
      const result = await this.expireCarryoverDays(tenantId, currentYear);
      results.push({
        tenantId,
        expiredBalances: result.expiredBalances,
        totalExpiredDays: result.totalExpiredDays,
      });
    }
    return results;
  }

  async resetBalancesForNewYear(
    tenantId: string,
    fromYear: number,
    toYear: number,
    allowCarryover: boolean = false,
    maxCarryoverDays: number = 0,
  ) {
    const previousYearBalances = await this.leaveBalanceRepository.find({
      where: { tenantId, year: fromYear },
      relations: ['leaveType'],
    });
    const newBalances: LeaveBalance[] = [];
    for (const oldBalance of previousYearBalances) {
      let carryoverDays = 0;
      if (allowCarryover && oldBalance.remainingDays > 0) {
        carryoverDays = Math.min(oldBalance.remainingDays, maxCarryoverDays);
      }
      const leaveType = oldBalance.leaveType;
      const totalDays = leaveType.defaultDays + carryoverDays;
      const newBalance = await this.createLeaveBalanceWithCarryover(
        tenantId,
        oldBalance.memberId,
        oldBalance.leaveTypeId,
        {
          year: toYear,
          regularDays: totalDays - carryoverDays,
          carryoverDays,
        },
      );
      newBalances.push(newBalance);
    }
    return newBalances;
  }

  async initializeYearWithCarryover(
    tenantId: string,
    memberId: string,
    leaveTypeId: string,
    newYear: number,
    regularDaysAllocation: number,
  ) {
    const carryoverInfo = await this.calculateCarryoverDays(
      tenantId,
      memberId,
      leaveTypeId,
      newYear - 1,
    );
    return this.createLeaveBalanceWithCarryover(tenantId, memberId, leaveTypeId, {
      year: newYear,
      regularDays: regularDaysAllocation,
      carryoverDays: carryoverInfo.carryoverDays,
      carryoverExpiryDate: carryoverInfo.expiryDate,
    });
  }
}
