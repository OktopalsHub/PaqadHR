import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LeaveStatus } from 'src/common/enums';
import { ProductAnalyticsService } from 'src/common/observability/product-analytics.service';
import { ActivitiesService } from '../../activities/services/activities.service';
import type { Leave } from '../entities/leave.entity';
import { LeaveRepository } from '../leave.repository';
import { LeaveBalanceService } from '../../leave-balance/leave-balance.service';
import { NotificationHelperService } from '../../notifications/services/notification-helper.service';

@Injectable()
export class LeaveApprovalService {
  private readonly logger = new Logger(LeaveApprovalService.name);
  constructor(
    private readonly leaveRepository: LeaveRepository,
    private readonly leaveBalanceService: LeaveBalanceService,
    private readonly activitiesService: ActivitiesService,
    private readonly notificationHelperService: NotificationHelperService,
    private readonly productAnalytics: ProductAnalyticsService,
  ) {}

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

  async approveLeave(tenantId: string, leaveId: string, approverId: string, comments?: string) {
    const leave = await this.findLeaveEntity(tenantId, leaveId);
    if (!leave) {
      throw new NotFoundException('Leave not found');
    }
    if (leave.requestedBy === approverId) {
      throw new ForbiddenException('You cannot approve your own leave request');
    }
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
    await this.logLeaveReviewActivity(tenantId, updated, approverId, 'leave.approved');

    void this.notificationHelperService
      .sendLeaveRequestNotification(updated.requestedBy, tenantId, {
        status: 'approved',
        startDate: String(updated.startDate),
        endDate: String(updated.endDate),
      })
      .catch((error) => {
        this.logger.error('Failed to send leave approval notification', error);
      });

    this.productAnalytics.capture(approverId, 'leave_approved', { tenantId });

    return updated;
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
    await this.logLeaveReviewActivity(tenantId, updated, approverId, 'leave.rejected');

    void this.notificationHelperService
      .sendLeaveRequestNotification(updated.requestedBy, tenantId, {
        status: 'rejected',
        startDate: String(updated.startDate),
        endDate: String(updated.endDate),
      })
      .catch((error) => {
        this.logger.error('Failed to send leave rejection notification', error);
      });

    this.productAnalytics.capture(approverId, 'leave_rejected', { tenantId });

    return updated;
  }

  private async findLeaveEntity(tenantId: string, leaveId: string): Promise<Leave | null> {
    return this.leaveRepository.findOne({
      where: { id: leaveId, tenantId },
      relations: [...this.leaveRelations],
    });
  }

  private async logLeaveReviewActivity(
    tenantId: string,
    leave: Leave,
    approverId: string,
    action: 'leave.approved' | 'leave.rejected',
  ): Promise<void> {
    const leaveTypeName = leave.leaveTypes?.name ?? 'Leave';
    const verb = action === 'leave.approved' ? 'approved' : 'rejected';
    await this.activitiesService.queueActivity({
      tenantId,
      actorMemberId: approverId,
      action,
      resourceType: 'leave',
      resourceId: leave.id,
      description: `Leave request ${verb}: ${leaveTypeName} (${leave.duration} days)`,
      metadata: {
        leaveType: leaveTypeName,
        duration: leave.duration,
        requesterId: leave.requestedBy,
      },
    });
  }
}
