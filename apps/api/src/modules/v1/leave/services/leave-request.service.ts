import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LeaveStatus } from 'src/common/enums';
import { DateTimeHelper } from 'src/common/helpers';
import { ProductAnalyticsService } from 'src/common/observability/product-analytics.service';
import { ActivitiesService } from '../../activities/services/activities.service';
import { LeaveBalanceService } from '../../leave-balance/leave-balance.service';
import { NotificationHelperService } from '../../notifications/services/notification-helper.service';
import { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import type { CreateLeaveDto } from '../dto/create-leave.dto';
import { LeaveRepository } from '../leave.repository';

@Injectable()
export class LeaveRequestService {
  private readonly logger = new Logger(LeaveRequestService.name);
  constructor(
    private readonly leaveRepository: LeaveRepository,
    private readonly leaveBalanceService: LeaveBalanceService,
    private readonly tenantSettingsService: TenantSettingsService,
    private readonly activitiesService: ActivitiesService,
    private readonly notificationHelperService: NotificationHelperService,
    private readonly productAnalytics: ProductAnalyticsService,
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
    const saved = await this.leaveRepository.save({
      ...dto,
      tenantId,
      requestedBy: memberId,
      duration: workingDays ?? durationInDays,
      startDate,
      endDate,
    });

    await this.activitiesService.queueActivity({
      tenantId,
      actorMemberId: memberId,
      action: 'leave.requested',
      resourceType: 'leave',
      resourceId: saved.id,
      description: `Leave request submitted (${saved.duration} days)`,
      metadata: {
        leaveTypeId: dto.leaveTypeId,
        duration: saved.duration,
        startDate: saved.startDate,
        endDate: saved.endDate,
      },
    });

    void this.notificationHelperService
      .sendLeaveRequestNotification(memberId, tenantId, {
        status: 'pending',
        startDate: String(saved.startDate),
        endDate: String(saved.endDate),
      })
      .catch((error) => {
        this.logger.error('Failed to send leave request notification', error);
      });

    this.productAnalytics.capture(memberId, 'leave_requested', { tenantId });

    await this.leaveBalanceService.applyLeaveImpact(saved, null);

    return saved;
  }

  async checkLeaveBalance(
    tenantId: string,
    memberId: string,
    leaveTypeId: string,
    requestedDays: number,
    startDate: Date,
    releaseDays = 0,
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
    const availableDays = balance.remainingDays + releaseDays;
    if (availableDays < requestedDays) {
      throw new ForbiddenException(
        `Insufficient leave balance. You have ${availableDays} days remaining, but requested ${requestedDays} days.`,
      );
    }
    if (availableDays === 0) {
      throw new ForbiddenException(
        'You have no remaining leave days for this leave type. Please contact HR if you need additional leave.',
      );
    }
    return balance;
  }

  async deleteLeave(tenantId: string, leaveId: string) {
    const leave = await this.leaveRepository.findOne({
      where: { id: leaveId, tenantId, status: LeaveStatus.PENDING },
    });
    if (!leave) {
      throw new ForbiddenException('You can only delete pending leave requests');
    }
    await this.leaveBalanceService.applyLeaveImpact(
      { ...leave, status: LeaveStatus.CANCELLED } as typeof leave,
      LeaveStatus.PENDING,
    );
    const result = await this.leaveRepository.softDelete({
      id: leaveId,
      tenantId,
      status: LeaveStatus.PENDING,
    });
    if (!result.affected) {
      throw new ForbiddenException('You can only delete pending leave requests');
    }
    return result;
  }
}
