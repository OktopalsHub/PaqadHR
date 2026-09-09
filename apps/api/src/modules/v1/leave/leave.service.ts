import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LeaveStatus } from 'src/common/enums';
import { DateTimeHelper } from 'src/common/helpers';
import type { IPaginationOption } from 'src/common/interfaces/pagination.interface';
import { getPaginationSummary, normalizePaginationLimit } from 'src/common/utils/pagination.util';
import type { FindOptionsWhere } from 'typeorm';
import { TenantSettingsService } from '../tenant-settings/services/tenant-settings.service';
import type { CreateLeaveDto } from './dto/create-leave.dto';
import { LeaveMemberMapper } from './dto/leave-member-response.dto';
import type { LeaveResponseDto } from './dto/leave-response.dto';
import type { UpdateLeaveDto } from './dto/update-leave.dto';
import type { Leave } from './entities/leave.entity';
import { LeaveRepository } from './leave.repository';
import { LeaveApprovalService } from './services/leave-approval.service';
import { LeaveBalanceUpdateService } from './services/leave-balance-update.service';
import { LeaveRequestService } from './services/leave-request.service';

@Injectable()
export class LeaveService {
  constructor(
    private readonly leaveRepository: LeaveRepository,
    private readonly leaveRequestService: LeaveRequestService,
    private readonly leaveApprovalService: LeaveApprovalService,
    private readonly leaveBalanceUpdateService: LeaveBalanceUpdateService,
    private readonly tenantSettingsService: TenantSettingsService,
  ) {}

  async createLeave(tenantId: string, memberId: string, dto: CreateLeaveDto) {
    return this.leaveRequestService.createLeave(tenantId, memberId, dto);
  }

  async checkLeaveBalance(
    tenantId: string,
    memberId: string,
    leaveTypeId: string,
    requestedDays: number,
    startDate: Date,
    releaseDays = 0,
  ) {
    return this.leaveRequestService.checkLeaveBalance(
      tenantId,
      memberId,
      leaveTypeId,
      requestedDays,
      startDate,
      releaseDays,
    );
  }

  async getLeaveBalanceForMember(tenantId: string, memberId: string, year?: number) {
    return this.leaveBalanceUpdateService.getLeaveBalanceForMember(tenantId, memberId, year);
  }

  async getLeaveBalanceForMemberByType(
    tenantId: string,
    memberId: string,
    leaveTypeId: string,
    year?: number,
  ) {
    return this.leaveBalanceUpdateService.getLeaveBalanceForMemberByType(
      tenantId,
      memberId,
      leaveTypeId,
      year,
    );
  }

  private readonly leaveRelations = [
    'requester',
    'requester.user',
    'requester.positionHistory',
    'requester.positionHistory.position',
    'requester.departmentMemberships',
    'requester.departmentMemberships.department',
    'approver',
    'approver.user',
    'approver.positionHistory',
    'approver.positionHistory.position',
    'approver.departmentMemberships',
    'approver.departmentMemberships.department',
    'leaveTypes',
  ] as const;

  private async findLeaveEntity(tenantId: string, leaveId: string): Promise<Leave | null> {
    return this.leaveRepository.findOne({
      where: { id: leaveId, tenantId },
      relations: [...this.leaveRelations],
    });
  }

  private async listLeavesPaginated(
    tenantId: string,
    pagination: IPaginationOption,
    additionalWhere: FindOptionsWhere<Leave> = {},
    name = 'leaves',
  ) {
    const page = Math.max(parseInt(String(pagination.page), 10) || 1, 1);
    const limit = normalizePaginationLimit(pagination.limit);
    const where: FindOptionsWhere<Leave> = { tenantId, ...additionalWhere };
    const [records, total] = await this.leaveRepository.findAndCount({
      where,
      relations: [...this.leaveRelations],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const paginated = await getPaginationSummary(records, total, pagination, name);
    return {
      ...paginated,
      records: paginated.records.map((leave) => this.toLeaveResponseDto(leave as Leave)),
    };
  }

  async listLeavesByTenant(
    tenantId: string,
    pagination: IPaginationOption,
    filters?: { status?: string; from?: string; to?: string; requesterIds?: string[] },
  ) {
    if (filters?.status || filters?.from || filters?.to || filters?.requesterIds?.length) {
      return this.listLeavesWithFilters(tenantId, pagination, filters);
    }
    return this.listLeavesPaginated(tenantId, pagination, {}, 'leaves');
  }

  private async listLeavesWithFilters(
    tenantId: string,
    pagination: IPaginationOption,
    filters: {
      status?: string;
      from?: string;
      to?: string;
      memberId?: string;
      requesterIds?: string[];
    },
  ) {
    const page = Math.max(parseInt(String(pagination.page), 10) || 1, 1);
    const limit = normalizePaginationLimit(pagination.limit);

    const qb = this.leaveRepository
      .createQueryBuilder('leave')
      .leftJoinAndSelect('leave.requester', 'requester')
      .leftJoinAndSelect('requester.user', 'requesterUser')
      .leftJoinAndSelect('requester.positionHistory', 'requesterPositionHistory')
      .leftJoinAndSelect('requesterPositionHistory.position', 'requesterPosition')
      .leftJoinAndSelect('leave.approver', 'approver')
      .leftJoinAndSelect('approver.user', 'approverUser')
      .leftJoinAndSelect('leave.leaveTypes', 'leaveTypes')
      .where('leave.tenantId = :tenantId', { tenantId });

    if (filters.memberId) {
      qb.andWhere('leave.requestedBy = :memberId', { memberId: filters.memberId });
    }

    if (filters.requesterIds?.length) {
      qb.andWhere('leave.requestedBy IN (:...requesterIds)', {
        requesterIds: filters.requesterIds,
      });
    }

    if (filters.status) {
      qb.andWhere('leave.status = :status', { status: filters.status.toUpperCase() });
    }
    if (filters.from) {
      qb.andWhere('leave.endDate >= :from', { from: filters.from });
    }
    if (filters.to) {
      qb.andWhere('leave.startDate <= :to', { to: filters.to });
    }

    qb.orderBy('leave.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [records, total] = await qb.getManyAndCount();
    const paginated = await getPaginationSummary(records, total, pagination, 'leaves');
    return {
      ...paginated,
      records: paginated.records.map((leave) => this.toLeaveResponseDto(leave as Leave)),
    };
  }

  async getLeavesByMember(
    tenantId: string,
    memberId: string,
    pagination: IPaginationOption,
    filters?: { status?: string; from?: string; to?: string },
  ) {
    if (filters?.status || filters?.from || filters?.to) {
      return this.listLeavesWithFilters(tenantId, pagination, {
        ...filters,
        memberId,
      });
    }
    return this.listLeavesPaginated(
      tenantId,
      pagination,
      { requestedBy: memberId },
      'member_leaves',
    );
  }

  async getLeave(tenantId: string, leaveId: string) {
    const leave = await this.findLeaveEntity(tenantId, leaveId);
    if (!leave) {
      throw new NotFoundException('Leave not found');
    }
    return this.toLeaveResponseDto(leave);
  }

  async updateLeave(tenantId: string, leaveId: string, dto: UpdateLeaveDto) {
    const existing = await this.findLeaveEntity(tenantId, leaveId);
    if (!existing) {
      throw new NotFoundException('Leave not found');
    }
    const nextLeaveTypeId = dto.leaveTypeId ?? existing.leaveTypeId;
    const oldDuration = existing.duration;
    const oldYear = new Date(existing.startDate).getFullYear();
    let duration = existing.duration;
    let nextStartDate = existing.startDate;

    if (dto.startDate || dto.endDate) {
      const tenantSettings = await this.tenantSettingsService.getTenantSettings(tenantId);
      const holidaySettings = tenantSettings?.settings?.holidays;
      nextStartDate = dto.startDate || existing.startDate;
      const { durationInDays, workingDays } = DateTimeHelper.calculateDuration(
        nextStartDate,
        dto.endDate || existing.endDate,
        holidaySettings,
      );
      duration = workingDays ?? durationInDays;
    }

    const nextYear = new Date(nextStartDate).getFullYear();
    const sameBalanceBucket = nextLeaveTypeId === existing.leaveTypeId && nextYear === oldYear;

    if (
      (dto.startDate || dto.endDate || dto.leaveTypeId) &&
      existing.requestedBy &&
      nextLeaveTypeId
    ) {
      await this.checkLeaveBalance(
        tenantId,
        existing.requestedBy,
        nextLeaveTypeId,
        duration,
        nextStartDate,
        sameBalanceBucket ? oldDuration : 0,
      );
    }

    const result = await this.leaveRepository.update(
      { id: existing.id, tenantId, status: LeaveStatus.PENDING },
      { ...dto, duration },
    );
    if (!result.affected) {
      throw new ForbiddenException('You can only modify pending leave requests');
    }

    if (existing.requestedBy && (dto.startDate || dto.endDate || dto.leaveTypeId)) {
      if (sameBalanceBucket) {
        await this.leaveBalanceUpdateService.adjustPendingOrApprovedDuration(
          tenantId,
          existing.requestedBy,
          existing.leaveTypeId,
          oldYear,
          oldDuration,
          duration,
          LeaveStatus.PENDING,
        );
      } else {
        await this.leaveBalanceUpdateService.releaseAndReserve(
          tenantId,
          existing,
          nextLeaveTypeId,
          nextStartDate,
          duration,
        );
      }
    }

    return this.getLeave(tenantId, leaveId);
  }

  async deleteLeave(tenantId: string, leaveId: string) {
    return this.leaveRequestService.deleteLeave(tenantId, leaveId);
  }

  async cancelLeave(tenantId: string, leaveId: string, actorMemberId: string) {
    const updated = await this.leaveApprovalService.cancelLeave(tenantId, leaveId, actorMemberId);
    return this.toLeaveResponseDto(updated);
  }

  async approveLeave(tenantId: string, leaveId: string, approverId: string, comments?: string) {
    const updated = await this.leaveApprovalService.approveLeave(
      tenantId,
      leaveId,
      approverId,
      comments,
    );
    return this.toLeaveResponseDto(updated);
  }

  async rejectLeave(tenantId: string, leaveId: string, approverId: string, comments: string) {
    const updated = await this.leaveApprovalService.rejectLeave(
      tenantId,
      leaveId,
      approverId,
      comments,
    );
    return this.toLeaveResponseDto(updated);
  }

  toLeaveResponseDto(leave: Leave): LeaveResponseDto {
    return {
      id: leave.id,
      startDate: leave.startDate,
      endDate: leave.endDate,
      duration: leave.duration,
      status: leave.status,
      reason: leave.reason || '',
      comments: leave.comments || undefined,
      reviewedAt: leave.reviewedAt || undefined,
      createdAt: leave.createdAt,
      updatedAt: leave.updatedAt,
      leaveType: leave.leaveTypes
        ? {
            id: leave.leaveTypes.id,
            name: leave.leaveTypes.name,
            description: leave.leaveTypes.description,
          }
        : null,
      requester: leave.requester ? LeaveMemberMapper.toResponse(leave.requester) : null,
      approver: leave.approver ? LeaveMemberMapper.toResponse(leave.approver) : null,
    };
  }
}
