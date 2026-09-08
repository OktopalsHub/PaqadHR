import { Injectable } from '@nestjs/common';
import { NotificationChannel } from '../../../../common/enums/notification-channel.enum';
import { NotificationPriority } from '../../../../common/enums/notification-priority.enum';
import { NotificationType } from '../../../../common/enums/notification-type.enum';
import { NotificationService } from './notification.service';

@Injectable()
export class LeaveNotificationsService {
  constructor(private readonly notificationService: NotificationService) {}

  async sendLeaveRequestNotification(
    recipientId: string,
    tenantId: string,
    variables: {
      status: string;
      startDate: string;
      endDate: string;
      requesterName?: string;
    },
  ): Promise<void> {
    const statusWord =
      variables.status === 'approved'
        ? 'approved'
        : variables.status === 'rejected'
          ? 'rejected'
          : 'updated';

    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel: NotificationChannel.BOTH,
      priority: NotificationPriority.MEDIUM,
      title: `Leave request ${statusWord}`,
      message: `Your leave request from ${variables.startDate} to ${variables.endDate} has been ${statusWord}.`,
      recipientId,
      tenantId,
    });
  }

  async sendLeaveBalanceUpdatedNotification(
    recipientId: string,
    tenantId: string,
    variables: {
      leaveTypeName: string;
      remainingDays: number;
      reason: string;
    },
  ): Promise<void> {
    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel: NotificationChannel.BOTH,
      priority: NotificationPriority.LOW,
      title: 'Leave balance updated',
      message: `Your ${variables.leaveTypeName} balance has been updated. Remaining: ${variables.remainingDays} day(s). Reason: ${variables.reason}`,
      recipientId,
      tenantId,
    });
  }
}
