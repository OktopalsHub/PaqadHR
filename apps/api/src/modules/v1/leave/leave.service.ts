import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LeaveStatus } from 'src/common/enums';
import { DateTimeHelper } from 'src/common/helpers';
import type { IPaginationOption } from 'src/common/interfaces/pagination.interface';
import { getPaginationSummary, normalizePaginationLimit } from 'src/common/utils/pagination.util';
import type { FindOptionsWhere } from 'typeorm';
import { LeaveBalanceService } from '../leave-balance/leave-balance.service';
import { TenantSettingsService } from '../tenant-settings/services/tenant-settings.service';
import type { CreateLeaveDto } from './dto/create-leave.dto';
import { LeaveMemberMapper } from './dto/leave-member-response.dto';
import type { LeaveResponseDto } from './dto/leave-response.dto';
import type { UpdateLeaveDto } from './dto/update-leave.dto';
import type { Leave } from './entities/leave.entity';
import { LeaveRepository } from './leave.repository';

@Injectable()
export class LeaveService {
  constructor(
    private readonly leaveRepository: LeaveRepository,
    private readonly leaveBalanceService: LeaveBalanceService,
    private readonly tenantSettingsService: TenantSettingsService,
  ) {}
  async createLeave(tenantId: string, memberId: string, dto: CreateLeaveDto) {
    const tenantSettings = await this.tenantSettingsService.getTenantSettings(tenantId);
    const holidaySettings = tenantSettings?.settings?.holidays;
    const { durationInDays, workingDays, startDate, endDate } = DateTimeHelper.calculateDuration(
      dto.startDate,
      dto.endDate,
      holidaySettings,
    );
    const daysToCheck = workingDays ?? durationInDays;
    await this.checkLeaveBalance(
      tenantId,
      memberId,
      dto.leaveTypeId,
      daysToCheck,
      new Date(startDate),
    );
    return this.leaveRepository.save({
      ...dto,
      tenantId,
      requestedBy: memberId,
      duration: workingDays ?? durationInDays,
      startDate,
      endDate,
    });
  }
  async checkLeaveBalance(
    tenantId: string,
    memberId: string,
    leaveTypeId: string,
    requestedDays: number,
    startDate: Date,
  ) {
    const year = new Date(startDate).getFullYear();
    const balance = await this.leaveBalanceService.findByCriteria({
      tenantId,
      memberId,
      leaveTypeId,
      year,
    });
    if (!balance) {
      throw new NotFoundException(
        'Leave balance record not found for this member and leave type. Please contact HR to set up your leave balance.',
      );
    }
    if (balance.remainingDays < requestedDays) {
      throw new ForbiddenException(
        `Insufficient leave balance. You have ${balance.remainingDays} days remaining, but requested ${requestedDays} days.`,
      );
    }
    if (balance.remainingDays === 0) {
      throw new ForbiddenException(
        'You have no remaining leave days for this leave type. Please contact HR if you need additional leave.',
      );
    }
    return balance;
  }
  async getLeaveBalanceForMember(tenantId: string, memberId: string, year?: number) {
    const currentYear = year || new Date().getFullYear();
    return this.leaveBalanceService.getBalancesByMember(tenantId, memberId, currentYear);
  }
  async getLeaveBalanceForMemberByType(
    tenantId: string,
    memberId: string,
    leaveTypeId: string,
    year?: number,
  ) {
    const currentYear = year || new Date().getFullYear();
    return this.leaveBalanceService.findByCriteria({
      tenantId,
      memberId,
      leaveTypeId,
      year: currentYear,
    });
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

  async listLeavesByTenant(tenantId: string, pagination: IPaginationOption) {
    return this.listLeavesPaginated(tenantId, pagination, {}, 'leaves');
  }
  async getLeavesByMember(tenantId: string, memberId: string, pagination: IPaginationOption) {
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
    const existing = await this.getLeave(tenantId, leaveId);
    if (dto.startDate || dto.endDate) {
      const tenantSettings = await this.tenantSettingsService.getTenantSettings(tenantId);
      const holidaySettings = tenantSettings?.settings?.holidays;
      const { durationInDays, workingDays } = DateTimeHelper.calculateDuration(
        dto.startDate || existing.startDate,
        dto.endDate || existing.endDate,
        holidaySettings,
      );
      const daysToCheck = workingDays ?? durationInDays;
      if (existing.requester && existing.leaveType) {
        await this.checkLeaveBalance(
          tenantId,
          existing.requester.id,
          existing.leaveType.id,
          daysToCheck,
          dto.startDate || existing.startDate,
        );
      }
    }
    return this.leaveRepository.update(existing.id, dto);
  }
  async deleteLeave(tenantId: string, leaveId: string) {
    const existing = await this.getLeave(tenantId, leaveId);
    return this.leaveRepository.softDelete(existing.id);
  }
  async approveLeave(tenantId: string, leaveId: string, approverId: string, comments?: string) {
    const leave = await this.findLeaveEntity(tenantId, leaveId);
    if (!leave) {
      throw new NotFoundException('Leave not found');
    }
    if (leave.requestedBy === approverId) {
      throw new ForbiddenException('You cannot approve your own leave request');
    }
    await this.checkLeaveBalance(
      tenantId,
      leave.requestedBy,
      leave.leaveTypeId,
      leave.duration,
      leave.startDate,
    );
    await this.leaveRepository.update(leave.id, {
      status: LeaveStatus.APPROVED,
      approvedBy: approverId,
      reviewedAt: new Date(),
      comments,
    });
    const updatedLeave = await this.findLeaveEntity(tenantId, leaveId);
    if (!updatedLeave) {
      throw new NotFoundException('Updated leave not found');
    }
    await this.leaveBalanceService.applyLeaveImpact(updatedLeave, LeaveStatus.PENDING);
    const updated = await this.findLeaveEntity(tenantId, leaveId);
    if (!updated) {
      throw new NotFoundException('Updated leave not found');
    }
    return this.toLeaveResponseDto(updated);
  }
  async rejectLeave(tenantId: string, leaveId: string, approverId: string, comments: string) {
    const leave = await this.findLeaveEntity(tenantId, leaveId);
    if (!leave) {
      throw new NotFoundException('Leave not found');
    }
    if (leave.requestedBy === approverId) {
      throw new ForbiddenException('You cannot approve your own leave request');
    }
    await this.leaveRepository.update(leave.id, {
      status: LeaveStatus.REJECTED,
      approvedBy: approverId,
      reviewedAt: new Date(),
      comments,
    });
    const updatedLeave = await this.findLeaveEntity(tenantId, leaveId);
    if (!updatedLeave) {
      throw new NotFoundException('Updated leave not found');
    }
    await this.leaveBalanceService.applyLeaveImpact(updatedLeave, LeaveStatus.PENDING);
    const updated = await this.findLeaveEntity(tenantId, leaveId);
    if (!updated) {
      throw new NotFoundException('Updated leave not found');
    }
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
