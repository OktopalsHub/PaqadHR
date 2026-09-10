import { Injectable } from '@nestjs/common';
import { NotificationChannel } from '../../../../common/enums/notification-channel.enum';
import { NotificationPriority } from '../../../../common/enums/notification-priority.enum';
import { NotificationType } from '../../../../common/enums/notification-type.enum';
import { NotificationService } from './notification.service';

@Injectable()
export class SystemNotificationsService {
  constructor(private readonly notificationService: NotificationService) {}

  async sendBillingRenewalFailedNotification(
    recipientId: string,
    tenantId: string,
    variables: {
      tenantName: string;
      reason: string;
      status: string;
    },
  ): Promise<void> {
    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel: NotificationChannel.BOTH,
      priority: NotificationPriority.HIGH,
      title: 'Subscription renewal failed',
      message: `Billing renewal for ${variables.tenantName} could not be completed (${variables.status}). ${variables.reason} Update your payment method to avoid service interruption.`,
      recipientId,
      tenantId,
    });
  }

  async sendSystemAnnouncement(
    title: string,
    message: string,
    tenantId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    if (tenantId) {
      await this.notificationService.sendTenantNotification(
        tenantId,
        title,
        message,
        NotificationChannel.BOTH,
        metadata,
      );
    } else {
      await this.notificationService.sendSystemNotification(
        title,
        message,
        NotificationChannel.BOTH,
        metadata,
      );
    }
  }

  async sendDocumentApprovalNotification(
    recipientId: string,
    tenantId: string,
    variables: {
      documentName: string;
      status: 'approved' | 'rejected' | 'pending_review';
      reviewerName: string;
      documentUrl?: string;
      comments?: string;
    },
  ): Promise<void> {
    const statusMessages = {
      approved: 'has been approved',
      rejected: 'has been rejected',
      pending_review: 'is pending review',
    };

    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel: NotificationChannel.BOTH,
      priority:
        variables.status === 'rejected' ? NotificationPriority.HIGH : NotificationPriority.MEDIUM,
      title: `Document ${variables.status === 'approved' ? 'approved' : variables.status === 'rejected' ? 'rejected' : 'under review'}`,
      message: `Your document "${variables.documentName}" ${statusMessages[variables.status]} by ${variables.reviewerName}${variables.comments ? `. Comments: ${variables.comments}` : ''}`,
      recipientId,
      tenantId,
      actionData: variables.documentUrl
        ? { url: variables.documentUrl, buttonText: 'View Document', actionType: 'navigate' }
        : undefined,
      metadata: {
        type: 'document_approval',
        documentName: variables.documentName,
        status: variables.status,
        reviewerName: variables.reviewerName,
      },
    });
  }

  async sendSecurityAlertNotification(
    recipientId: string,
    tenantId: string,
    variables: {
      alertType: string;
      description: string;
      ipAddress?: string;
      timestamp: string;
    },
  ): Promise<void> {
    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel: NotificationChannel.BOTH,
      priority: NotificationPriority.URGENT,
      title: 'Security alert',
      message: `${variables.alertType}: ${variables.description}${variables.ipAddress ? ` from IP ${variables.ipAddress}` : ''} at ${variables.timestamp}`,
      recipientId,
      tenantId,
      metadata: {
        type: 'security_alert',
        alertType: variables.alertType,
        ipAddress: variables.ipAddress,
        timestamp: variables.timestamp,
      },
    });
  }
}
