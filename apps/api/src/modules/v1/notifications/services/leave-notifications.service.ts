import { Injectable } from '@nestjs/common';
import { NotificationChannel } from '../../../../common/enums/notification-channel.enum';
import { NotificationPriority } from '../../../../common/enums/notification-priority.enum';
import { NotificationType } from '../../../../common/enums/notification-type.enum';
import { NotificationService } from './notification.service';

/** Words that read correctly in "Your leave request … has been <word>." */
const STATUS_WORDS: Record<string, string> = {
  approved: 'approved',
  rejected: 'rejected',
  cancelled: 'cancelled',
};

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
    },
  ): Promise<void> {
    const statusWord = STATUS_WORDS[variables.status];
    if (!statusWord) return;

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
}
