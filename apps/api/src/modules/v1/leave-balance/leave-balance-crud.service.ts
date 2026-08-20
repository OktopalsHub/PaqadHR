import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivitiesService } from '../activities/services/activities.service';
import type { CreateLeaveBalanceDto } from './dto/create-leave-balance.dto';
import type { UpdateLeaveBalanceDto } from './dto/update-leave-balance.dto';
import type { LeaveBalance } from './entities/leave-balance.entity';
import { LeaveBalanceRepository } from './leave-balance.repository';

@Injectable()
export class LeaveBalanceCrudService {
  constructor(
    private readonly leaveBalanceRepository: LeaveBalanceRepository,
    private readonly activitiesService: ActivitiesService,
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
    await this.leaveBalanceRepository.softDelete(balanceId);
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

  async getBalancesByMember(tenantId: string, memberId: string, year: number) {
    return this.leaveBalanceRepository.find({
      where: { tenantId, memberId, year },
      relations: ['leaveType'],
    });
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
}
