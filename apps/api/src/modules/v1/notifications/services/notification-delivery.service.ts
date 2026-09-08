import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel } from '../../../../common/enums/notification-channel.enum';
import { NotificationStatus } from '../../../../common/enums/notification-status.enum';
import { NotificationType } from '../../../../common/enums/notification-type.enum';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import { Notification } from '../entities/notification.entity';
import { SSENotificationService } from './sse-notification.service';
import { ZeptomailEmailService } from './zeptomail-email.service';

@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);

  constructor(
    private emailService: ZeptomailEmailService,
    private sseNotificationService: SSENotificationService,
    private tenantMembersService: TenantMembersService,
  ) {}

  async deliver(
    notificationRepository: import('typeorm').Repository<Notification>,
    notification: Notification,
  ): Promise<void> {
    try {
      const shouldSendEmail =
        notification.channel === NotificationChannel.EMAIL ||
        notification.channel === NotificationChannel.BOTH;

      const shouldSendInApp =
        notification.channel === NotificationChannel.IN_APP ||
        notification.channel === NotificationChannel.BOTH;

      if (shouldSendEmail) await this.sendEmail(notification);
      if (shouldSendInApp) this.sendInApp(notification);

      await notificationRepository.update(notification.id, {
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      });
    } catch (error) {
      this.logger.error(`Failed to deliver notification ${notification.id}:`, error);
      await notificationRepository.update(notification.id, {
        status: NotificationStatus.FAILED,
      });
    }
  }

  private async sendEmail(notification: Notification): Promise<void> {
    if (!notification.recipientId || !notification.tenantId) {
      this.logger.warn('Cannot send email without recipient and tenant');
      return;
    }

    const email = await this.getRecipientEmail(notification.recipientId, notification.tenantId);
    if (!email) {
      this.logger.warn(`No email found for recipient ${notification.recipientId}`);
      return;
    }

    await this.emailService.sendTemplateEmail(email, 'notification', {
      title: notification.title,
      message: notification.message,
      actionUrl: notification.actionData?.url,
      actionLabel: notification.actionData?.buttonText,
    });
  }

  private sendInApp(notification: Notification): void {
    const payload = {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      metadata: notification.metadata,
      actionData: notification.actionData,
    };

    if (notification.type === NotificationType.SYSTEM) {
      this.sseNotificationService.sendSystemNotification(payload);
    } else if (notification.type === NotificationType.TENANT && notification.tenantId) {
      this.sseNotificationService.sendToTenant(notification.tenantId, payload);
    } else if (notification.recipientId) {
      this.sseNotificationService.sendToUser(notification.recipientId, payload);
    }
  }

  private async getRecipientEmail(recipientId: string, tenantId: string): Promise<string | null> {
    try {
      const member = await this.tenantMembersService.getTenantMember(recipientId, tenantId);
      return member.user?.email ?? null;
    } catch (error) {
      this.logger.error(`Failed to get recipient email for ${recipientId}:`, error);
      return null;
    }
  }
}
