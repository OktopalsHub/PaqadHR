import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaveBalanceService } from '../leave-balance/leave-balance.service';
import { LeaveTypeService } from '../leave-type/leave-type.service';
import { TenantMember } from '../tenant-members/entities/tenant-member.entity';
import type { LeaveBalance } from './entities/leave-balance.entity';

@Injectable()
export class LeaveBalanceInitializationService {
  constructor(
    private readonly leaveBalanceService: LeaveBalanceService,
    private readonly leaveTypeService: LeaveTypeService,
    @InjectRepository(TenantMember)
    private readonly tenantMemberRepository: Repository<TenantMember>,
  ) {}
  async initializeLeaveBalancesForNewEmployee(tenantId: string, memberId: string, joinDate?: Date) {
    const currentYear = new Date().getFullYear();
    const joinYear = joinDate ? joinDate.getFullYear() : currentYear;
    const leaveTypes = await this.leaveTypeService.listLeaveTypes(tenantId);
    const activeLeaveTypes = leaveTypes.filter((lt) => lt.isActive && lt.tenantId === tenantId);
    const balances: LeaveBalance[] = [];
    for (const leaveType of activeLeaveTypes) {
      const existingBalance = await this.leaveBalanceService.findByCriteria({
        tenantId,
        memberId,
        leaveTypeId: leaveType.id,
        year: joinYear,
      });
      if (!existingBalance) {
        const allocatedDays = this.calculateProratedDays(leaveType.defaultDays, joinDate, joinYear);
        const newBalance = await this.leaveBalanceService.createLeaveBalance(
          tenantId,
          memberId,
          leaveType.id,
          {
            year: joinYear,
            totalDays: allocatedDays,
            usedDays: 0,
            remainingDays: allocatedDays,
          },
        );
        balances.push(newBalance);
      }
    }
    if (joinYear === currentYear && this.shouldCreateNextYearBalance(joinDate)) {
      await this.createNextYearBalances(tenantId, memberId, activeLeaveTypes);
    }
    return balances;
  }
  async bulkInitializeLeaveBalances(tenantId: string, memberIds: string[], year?: number) {
    const targetYear = year || new Date().getFullYear();
    const leaveTypes = await this.leaveTypeService.listLeaveTypes(tenantId);
    const activeLeaveTypes = leaveTypes.filter((lt) => lt.isActive);
    const activeLeaveTypeIds = activeLeaveTypes.map((lt) => lt.id);
    const existingBalances = await this.leaveBalanceService.findExistingBalances(
      tenantId,
      memberIds,
      activeLeaveTypeIds,
      targetYear,
    );
    const existingSet = new Set(existingBalances.map((b) => `${b.memberId}:${b.leaveTypeId}`));
    const results: {
      memberId: string;
      balancesCreated: number;
      balances: LeaveBalance[];
    }[] = [];
    for (const memberId of memberIds) {
      const memberBalances: LeaveBalance[] = [];
      for (const leaveType of activeLeaveTypes) {
        if (!existingSet.has(`${memberId}:${leaveType.id}`)) {
          const newBalance = await this.leaveBalanceService.createLeaveBalance(
            tenantId,
            memberId,
            leaveType.id,
            {
              year: targetYear,
              totalDays: leaveType.defaultDays,
              usedDays: 0,
              remainingDays: leaveType.defaultDays,
            },
          );
          memberBalances.push(newBalance);
        }
      }
      results.push({
        memberId,
        balancesCreated: memberBalances.length,
        balances: memberBalances,
      });
    }
    return results;
  }
  async initializeNewLeaveTypeForAllMembers(
    tenantId: string,
    leaveTypeId: string,
    defaultDays: number,
    memberIds: string[],
    year?: number,
  ) {
    const targetYear = year || new Date().getFullYear();
    const results: LeaveBalance[] = [];
    for (const memberId of memberIds) {
      const existingBalance = await this.leaveBalanceService.findByCriteria({
        tenantId,
        memberId,
        leaveTypeId,
        year: targetYear,
      });
      if (!existingBalance) {
        const newBalance = await this.leaveBalanceService.createLeaveBalance(
          tenantId,
          memberId,
          leaveTypeId,
          {
            year: targetYear,
            totalDays: defaultDays,
            usedDays: 0,
            remainingDays: defaultDays,
          },
        );
        results.push(newBalance);
      }
    }
    return results;
  }
  async createAnnualBalances(tenantId: string, year: number) {
    const leaveTypes = await this.leaveTypeService.listLeaveTypes(tenantId);
    const activeLeaveTypes = leaveTypes.filter((lt) => lt.isActive);
    const members = await this.listActiveTenantMembers(tenantId);
    const results: {
      memberId: string;
      balancesCreated: number;
      balances: LeaveBalance[];
    }[] = [];
    for (const member of members) {
      const memberBalances: LeaveBalance[] = [];
      for (const leaveType of activeLeaveTypes) {
        const existingBalance = await this.leaveBalanceService.findByCriteria({
          tenantId,
          memberId: member.id,
          leaveTypeId: leaveType.id,
          year,
        });
        if (!existingBalance) {
          const carryoverDays = await this.calculateCarryoverDays(
            tenantId,
            member.id,
            leaveType.id,
            year - 1,
          );
          const totalDays = leaveType.defaultDays + carryoverDays;
          const newBalance = await this.leaveBalanceService.createLeaveBalance(
            tenantId,
            member.id,
            leaveType.id,
            {
              year,
              totalDays,
              usedDays: 0,
              remainingDays: totalDays,
            },
          );
          memberBalances.push(newBalance);
        }
      }
      results.push({
        memberId: member.id,
        balancesCreated: memberBalances.length,
        balances: memberBalances,
      });
    }
    return results;
  }
  private calculateProratedDays(defaultDays: number, joinDate?: Date, year?: number): number {
    if (!joinDate) return defaultDays;
    const currentYear = year || new Date().getFullYear();
    const joinYear = joinDate.getFullYear();
    if (joinYear < currentYear) {
      return defaultDays;
    }
    const joinMonth = joinDate.getMonth();
    const remainingMonths = 12 - joinMonth;
    return Math.ceil((defaultDays * remainingMonths) / 12);
  }
  private shouldCreateNextYearBalance(joinDate?: Date): boolean {
    if (!joinDate) return false;
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    return currentMonth >= 9;
  }
  private async createNextYearBalances(
    tenantId: string,
    memberId: string,
    leaveTypes: Array<{ id: string; defaultDays: number }>,
  ) {
    const nextYear = new Date().getFullYear() + 1;
    for (const leaveType of leaveTypes) {
      const existingBalance = await this.leaveBalanceService.findByCriteria({
        tenantId,
        memberId,
        leaveTypeId: leaveType.id,
        year: nextYear,
      });
      if (!existingBalance) {
        await this.leaveBalanceService.createLeaveBalance(tenantId, memberId, leaveType.id, {
          year: nextYear,
          totalDays: leaveType.defaultDays,
          usedDays: 0,
          remainingDays: leaveType.defaultDays,
        });
      }
    }
  }
  private async calculateCarryoverDays(
    tenantId: string,
    memberId: string,
    leaveTypeId: string,
    previousYear: number,
  ): Promise<number> {
    const previousBalance = await this.leaveBalanceService.findByCriteria({
      tenantId,
      memberId,
      leaveTypeId,
      year: previousYear,
    });
    if (!previousBalance) return 0;
    const maxCarryover = 5;
    const carryoverPercentage = 0.5;
    const eligibleCarryover = Math.min(
      previousBalance.remainingDays,
      Math.ceil(previousBalance.remainingDays * carryoverPercentage),
      maxCarryover,
    );
    return eligibleCarryover;
  }
  private async listActiveTenantMembers(tenantId: string): Promise<TenantMember[]> {
    return this.tenantMemberRepository.find({
      where: {
        tenantId,
      },
    });
  }
}
