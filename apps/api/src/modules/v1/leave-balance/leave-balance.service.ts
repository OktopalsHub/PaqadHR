import { Injectable, NotFoundException } from '@nestjs/common';
import { LeaveStatus } from 'src/common/enums';
import type { CarryoverExpirationResult } from 'src/common/interfaces';
import type { Leave } from '../leave/entities/leave.entity';
import { LeavePolicyService } from '../leave-policy/leave-policy.service';
import type { CreateLeaveBalanceDto } from './dto/create-leave-balance.dto';
import type { UpdateLeaveBalanceDto } from './dto/update-leave-balance.dto';
import type { LeaveBalance } from './entities/leave-balance.entity';
import { LeaveBalanceRepository } from './leave-balance.repository';

@Injectable()
export class LeaveBalanceService {
  constructor(
    private readonly leaveBalanceRepository: LeaveBalanceRepository,
    private readonly leavePolicyService: LeavePolicyService,
  ) {}
  async createLeaveBalance(
    tenantId: string,
    memberId: string,
    leaveTypeId: string,
    dto: CreateLeaveBalanceDto,
  ): Promise<LeaveBalance> {
    return this.leaveBalanceRepository.save({
      ...dto,
      tenantId,
      memberId,
      leaveTypeId,
    });
  }
  async listLeaveBalances(tenantId: string, memberIds?: string[]) {
    const rows = await this.leaveBalanceRepository.findAdminListWithLabels(tenantId, memberIds);
    return rows.map((row) => {
      const nameParts = [row.memberFirstName, row.memberLastName]
        .map((part) => part?.trim())
        .filter((part): part is string => Boolean(part));
      return {
        id: row.id,
        memberId: row.memberId,
        leaveTypeId: row.leaveTypeId,
        totalDays: Number(row.totalDays),
        usedDays: Number(row.usedDays),
        remainingDays: Number(row.remainingDays),
        carryoverDays: Number(row.carryoverDays),
        regularDays: Number(row.regularDays),
        carryoverUsed: Number(row.carryoverUsed),
        year: Number(row.year),
        tenantId: row.tenantId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        memberName: nameParts.length > 0 ? nameParts.join(' ') : null,
        leaveTypeName: row.leaveTypeName?.trim() || null,
      };
    });
  }
  async getLeaveBalance(balanceId: string, tenantId: string) {
    return this.leaveBalanceRepository.findOne({
      where: { id: balanceId, tenantId },
    });
  }
  async updateLeaveBalance(balanceId: string, dto: UpdateLeaveBalanceDto, tenantId: string) {
    const existingBalance = await this.getLeaveBalance(balanceId, tenantId);
    if (!existingBalance) {
      throw new NotFoundException('Leave balance not found or access denied');
    }
    await this.leaveBalanceRepository.update(balanceId, dto);
    return this.leaveBalanceRepository.findOne({
      where: { id: balanceId, tenantId },
    });
  }
  async deleteLeaveBalance(tenantId: string, balanceId: string) {
    const existingBalance = await this.getLeaveBalance(balanceId, tenantId);
    if (!existingBalance) {
      throw new NotFoundException('Leave balance not found or access denied');
    }
    return this.leaveBalanceRepository.softDelete(balanceId);
  }
  async findByCriteria(criteria: {
    tenantId: string;
    memberId: string;
    leaveTypeId: string;
    year: number;
  }) {
    return this.leaveBalanceRepository.findByCriteria(criteria);
  }
  async getBalancesByMember(tenantId: string, memberId: string, year: number) {
    return this.leaveBalanceRepository.find({
      where: { tenantId, memberId, year },
      relations: ['leaveType'],
    });
  }
  async applyLeaveImpact(leave: Leave, previousStatus: LeaveStatus) {
    const balance = await this.findByCriteria({
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
    const balance = await this.findByCriteria({
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
  async getBalanceSummary(tenantId: string, memberId: string, year?: number) {
    const currentYear = year || new Date().getFullYear();
    const balances = await this.getBalancesByMember(tenantId, memberId, currentYear);
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
    const balance = await this.findByCriteria({
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
      const newBalance = await this.createLeaveBalance(
        tenantId,
        oldBalance.memberId,
        oldBalance.leaveTypeId,
        {
          year: toYear,
          totalDays,
          usedDays: 0,
          remainingDays: totalDays,
        },
      );
      newBalances.push(newBalance);
    }
    return newBalances;
  }
  async bulkUpdateBalances(
    updates: Array<{
      balanceId: string;
      totalDays?: number;
      usedDays?: number;
      remainingDays?: number;
    }>,
  ) {
    const results: (LeaveBalance | null)[] = [];
    for (const update of updates) {
      const { balanceId, ...updateData } = update;
      await this.leaveBalanceRepository.update(balanceId, updateData);
      const updatedBalance = await this.leaveBalanceRepository.findOne({
        where: { id: balanceId },
      });
      results.push(updatedBalance);
    }
    return results;
  }
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
    const previousBalance = await this.findByCriteria({
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
  private getAvailableCarryoverDays(balance: LeaveBalance, currentDate: Date): number {
    if (balance.carryoverDays === 0) return 0;
    if (balance.carryoverExpiryDate && currentDate > balance.carryoverExpiryDate) {
      return 0;
    }
    return Math.max(0, balance.carryoverDays - balance.carryoverUsed);
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
  async getDetailedBalance(tenantId: string, memberId: string, leaveTypeId: string, year: number) {
    const balance = await this.findByCriteria({
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
