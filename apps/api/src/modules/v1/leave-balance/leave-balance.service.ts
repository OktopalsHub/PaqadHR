import { Injectable, NotFoundException } from '@nestjs/common';
import type { LeaveStatus } from 'src/common/enums';
import { ActivitiesService } from '../activities/services/activities.service';
import type { Leave } from '../leave/entities/leave.entity';
import type { CreateLeaveBalanceDto } from './dto/create-leave-balance.dto';
import type { UpdateLeaveBalanceDto } from './dto/update-leave-balance.dto';
import type { LeaveBalance } from './entities/leave-balance.entity';
import { LeaveBalanceRepository } from './leave-balance.repository';
import { LeaveBalanceAccrualService } from './leave-balance-accrual.service';

@Injectable()
export class LeaveBalanceService {
  constructor(
    private readonly leaveBalanceRepository: LeaveBalanceRepository,
    private readonly activitiesService: ActivitiesService,
    private readonly leaveBalanceAccrualService: LeaveBalanceAccrualService,
  ) {}

  async createLeaveBalance(
    tenantId: string,
    memberId: string,
    leaveTypeId: string,
    dto: CreateLeaveBalanceDto,
    actorMemberId?: string,
  ): Promise<LeaveBalance> {
    const balance = await this.leaveBalanceRepository.save({
      ...dto,
      tenantId,
      memberId,
      leaveTypeId,
    });
    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'leave.balance_created',
          resourceType: 'leave_balance',
          resourceId: balance.id,
          description: `Leave balance created for member`,
          metadata: { memberId, leaveTypeId, totalDays: dto.totalDays },
        })
        .catch(() => {});
    }
    return balance;
  }

  async createLeaveBalancesBatch(
    tenantId: string,
    records: {
      memberId: string;
      leaveTypeId: string;
      year: number;
      totalDays: number;
      usedDays: number;
      remainingDays: number;
    }[],
  ): Promise<LeaveBalance[]> {
    if (records.length === 0) return [];
    return this.leaveBalanceRepository.save(
      records.map((r) => ({
        ...r,
        tenantId,
      })),
    );
  }

  async listLeaveBalances(tenantId: string, memberIds?: string[]) {
    const rows = await this.leaveBalanceRepository.findAdminListWithLabels(tenantId, memberIds);
    return rows.map((row) => {
      const nameParts = [row.memberFirstName, row.memberLastName]
        .map((p) => p?.trim())
        .filter((p): p is string => Boolean(p));
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

  async updateLeaveBalance(
    balanceId: string,
    dto: UpdateLeaveBalanceDto,
    tenantId: string,
    actorMemberId?: string,
  ) {
    const existingBalance = await this.getLeaveBalance(balanceId, tenantId);
    if (!existingBalance) {
      throw new NotFoundException('Leave balance not found or access denied');
    }
    await this.leaveBalanceRepository.update(balanceId, dto);
    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'leave.balance_updated',
          resourceType: 'leave_balance',
          resourceId: balanceId,
          description: `Leave balance updated`,
          metadata: { memberId: existingBalance.memberId, changes: dto },
        })
        .catch(() => {});
    }
    return this.leaveBalanceRepository.findOne({
      where: { id: balanceId, tenantId },
    });
  }

  async deleteLeaveBalance(tenantId: string, balanceId: string, actorMemberId?: string) {
    const existingBalance = await this.getLeaveBalance(balanceId, tenantId);
    if (!existingBalance) {
      throw new NotFoundException('Leave balance not found or access denied');
    }
    const result = await this.leaveBalanceRepository.softDelete({ id: balanceId, tenantId });
    if (result.affected === 0) {
      throw new NotFoundException('Leave balance not found or access denied');
    }
    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'leave.balance_deleted',
          resourceType: 'leave_balance',
          resourceId: balanceId,
          description: `Leave balance deleted`,
          metadata: {
            memberId: existingBalance.memberId,
            leaveTypeId: existingBalance.leaveTypeId,
          },
        })
        .catch(() => {});
    }
  }

  async findByCriteria(criteria: {
    tenantId: string;
    memberId: string;
    leaveTypeId: string;
    year: number;
  }) {
    return this.leaveBalanceRepository.findByCriteria(criteria);
  }

  async findExistingBalances(
    tenantId: string,
    memberIds: string[],
    leaveTypeIds: string[],
    year: number,
  ) {
    return this.leaveBalanceRepository.findExistingBalances(
      tenantId,
      memberIds,
      leaveTypeIds,
      year,
    );
  }

  async getBalancesByMember(tenantId: string, memberId: string, year: number) {
    return this.leaveBalanceRepository.find({
      where: { tenantId, memberId, year },
      relations: ['leaveType'],
    });
  }

  async applyLeaveImpact(leave: Leave, previousStatus: LeaveStatus) {
    return this.leaveBalanceAccrualService.applyLeaveImpact(leave, previousStatus);
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
    return this.leaveBalanceAccrualService.updateBalanceForModifiedLeave(
      tenantId,
      memberId,
      leaveTypeId,
      year,
      oldDuration,
      newDuration,
      leaveStatus,
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
    const results: (LeaveBalance | null)[] = [];
    for (const { balanceId, ...updateData } of updates) {
      await this.leaveBalanceRepository.update(balanceId, updateData);
      results.push(await this.leaveBalanceRepository.findOne({ where: { id: balanceId } }));
    }
    return results;
  }
}
