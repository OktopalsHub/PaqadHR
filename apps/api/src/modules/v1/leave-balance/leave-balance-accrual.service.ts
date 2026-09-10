import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LeaveStatus } from 'src/common/enums';
import type { Leave } from '../leave/entities/leave.entity';
import { LeavePolicyService } from '../leave-policy/leave-policy.service';
import { NotificationHelperService } from '../notifications/services/notification-helper.service';
import type { LeaveBalance } from './entities/leave-balance.entity';
import { LeaveBalanceRepository } from './leave-balance.repository';
import { LeaveBalanceCalcService } from './leave-balance-calc.service';
import { leaveBalanceUsedDaysChange } from './leave-balance-impact.util';

@Injectable()
export class LeaveBalanceAccrualService {
  private readonly logger = new Logger(LeaveBalanceAccrualService.name);
  constructor(
    private readonly leaveBalanceRepository: LeaveBalanceRepository,
    private readonly leavePolicyService: LeavePolicyService,
    private readonly notificationHelperService: NotificationHelperService,
    private readonly leaveBalanceCalcService: LeaveBalanceCalcService,
  ) {}

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

  async applyLeaveUsage(balanceId: string, daysToUse: number, leaveDate: Date) {
    const balance = await this.leaveBalanceRepository.findOne({
      where: { id: balanceId },
    });
    if (!balance) {
      throw new NotFoundException('Leave balance not found');
    }
    const availableCarryover = this.leaveBalanceCalcService.getAvailableCarryoverDays(
      balance,
      leaveDate,
    );
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
    const results: { tenantId: string; expiredBalances: number; totalExpiredDays: number }[] = [];
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

  async initializeYearWithCarryover(
    tenantId: string,
    memberId: string,
    leaveTypeId: string,
    newYear: number,
    regularDaysAllocation: number,
  ) {
    const carryoverInfo = await this.leaveBalanceCalcService.calculateCarryoverDays(
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
      const newBalance = await this.leaveBalanceRepository.create({
        tenantId,
        memberId: oldBalance.memberId,
        leaveTypeId: oldBalance.leaveTypeId,
        year: toYear,
        totalDays,
        regularDays: leaveType.defaultDays,
        carryoverDays,
        carryoverExpiryDate: null,
        usedDays: 0,
        remainingDays: totalDays,
        carryoverUsed: 0,
      });
      newBalances.push(newBalance);
    }
    return newBalances;
  }

  /**
   * Reservation model: pending create reserves days; approve keeps reservation;
   * reject/delete pending and cancel approved release days.
   * Pass previousStatus=null for a newly created pending leave.
   */
  async applyLeaveImpact(leave: Leave, previousStatus: LeaveStatus | null) {
    const balance = await this.leaveBalanceRepository.findByCriteria({
      tenantId: leave.tenantId,
      memberId: leave.requestedBy,
      leaveTypeId: leave.leaveTypeId,
      year: new Date(leave.startDate).getFullYear(),
    });
    if (!balance) {
      throw new NotFoundException('Leave balance not found');
    }
    const usedDaysChange = leaveBalanceUsedDaysChange(previousStatus, leave.status, leave.duration);
    if (usedDaysChange !== 0) {
      const newUsedDays = balance.usedDays + usedDaysChange;
      const newRemainingDays = balance.totalDays - newUsedDays;
      await this.leaveBalanceRepository.update(balance.id, {
        usedDays: newUsedDays,
        remainingDays: newRemainingDays,
      });

      void this.notificationHelperService
        .sendLeaveBalanceUpdatedNotification(leave.requestedBy, leave.tenantId, {
          leaveTypeName: leave.leaveTypes?.name ?? 'Leave',
          remainingDays: newRemainingDays,
          reason: usedDaysChange > 0 ? 'Leave requested' : 'Leave cancelled',
        })
        .catch((error) => {
          this.logger.error('Failed to send leave balance notification', error);
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
    if (leaveStatus !== LeaveStatus.APPROVED && leaveStatus !== LeaveStatus.PENDING) {
      return;
    }
    const durationDifference = newDuration - oldDuration;
    if (durationDifference === 0) {
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
    const newUsedDays = balance.usedDays + durationDifference;
    const newRemainingDays = balance.totalDays - newUsedDays;
    await this.leaveBalanceRepository.update(balance.id, {
      usedDays: newUsedDays,
      remainingDays: newRemainingDays,
    });
  }
}
