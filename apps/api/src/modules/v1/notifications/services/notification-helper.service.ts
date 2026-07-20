import { Injectable } from '@nestjs/common';
import { NotificationChannel } from '../../../../common/enums/notification-channel.enum';
import { NotificationPriority } from '../../../../common/enums/notification-priority.enum';
import { NotificationType } from '../../../../common/enums/notification-type.enum';
import { NotificationService } from './notification.service';

@Injectable()
export class NotificationHelperService {
  constructor(private readonly notificationService: NotificationService) {}
  async sendWelcomeNotification(
    recipientId: string,
    tenantId: string,
    variables: { name: string; tenantName: string; ctaUrl?: string },
  ): Promise<void> {
    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel: NotificationChannel.BOTH,
      priority: NotificationPriority.MEDIUM,
      title: `Welcome to ${variables.tenantName}!`,
      message: `Hi ${variables.name}, welcome to ${variables.tenantName}. We're glad you're here.`,
      recipientId,
      tenantId,
      emailTemplate: 'welcome',
      emailContext: {
        firstName: variables.name,
        email: undefined,
        tenantName: variables.tenantName,
        setupUrl: variables.ctaUrl,
        workspaceUrl: variables.ctaUrl,
        trialUrl: variables.ctaUrl,
        docsUrl: variables.ctaUrl,
      },
    });
  }
  async sendInvitationNotification(
    email: string,
    variables: { inviterName: string; tenantName: string; inviteLink: string },
  ): Promise<void> {}
  async sendPayrollNotification(
    recipientId: string,
    tenantId: string,
    variables: {
      employeeName: string;
      payrollPeriod: string;
      amount: number;
      currency: string;
    },
  ): Promise<void> {
    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel: NotificationChannel.BOTH,
      priority: NotificationPriority.HIGH,
      title: 'Payroll Processed',
      message: `Hi ${variables.employeeName}, your payroll for ${variables.payrollPeriod} has been processed. Amount: ${variables.currency} ${variables.amount}`,
      recipientId,
      tenantId,
    });
  }

  async sendPayslipPublishedNotification(
    recipientId: string,
    tenantId: string,
    variables: {
      employeeName: string;
      payrollPeriod: string;
      profileUrl: string;
      documentId?: string;
      payrollRunId?: string;
    },
  ): Promise<void> {
    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel: NotificationChannel.BOTH,
      priority: NotificationPriority.HIGH,
      title: 'Your payslip is ready',
      message: `Hi ${variables.employeeName}, your payslip for ${variables.payrollPeriod} is ready to download.`,
      recipientId,
      tenantId,
      actionData: {
        url: variables.profileUrl,
        buttonText: 'Download payslip',
        actionType: 'navigate',
      },
      metadata: {
        type: 'payslip_published',
        documentId: variables.documentId,
        payrollRunId: variables.payrollRunId,
      },
    });
  }

  async sendPayrollPaymentSetupReminder(
    recipientId: string,
    tenantId: string,
    variables: {
      employeeName: string;
      payrollPeriod: string;
      message: string;
    },
  ): Promise<void> {
    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel: NotificationChannel.BOTH,
      priority: NotificationPriority.HIGH,
      title: 'Action required: payroll payment details',
      message: `Hi ${variables.employeeName}, ${variables.message} Payroll period: ${variables.payrollPeriod}.`,
      recipientId,
      tenantId,
    });
  }

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
    const statusMessage =
      variables.status === 'approved'
        ? 'approved'
        : variables.status === 'rejected'
          ? 'rejected'
          : 'updated';
    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel: NotificationChannel.BOTH,
      priority: NotificationPriority.MEDIUM,
      title: `Leave Request ${statusMessage}`,
      message: `Your leave request from ${variables.startDate} to ${variables.endDate} has been ${statusMessage}.`,
      recipientId,
      tenantId,
    });
  }
  async sendShoutoutNotification(
    recipientId: string,
    tenantId: string,
    variables: {
      senderName: string;
      message: string;
      points?: number;
    },
  ): Promise<void> {
    const pointsText = variables.points ? ` (+${variables.points} Paq points)` : '';
    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel: NotificationChannel.BOTH,
      priority: NotificationPriority.MEDIUM,
      title: 'You received a shoutout!',
      message: `${variables.senderName} gave you a shoutout: "${variables.message}"${pointsText}`,
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
  async sendTaskAssignmentNotification(
    recipientId: string,
    tenantId: string,
    variables: {
      taskTitle: string;
      assignerName: string;
      dueDate?: string;
      taskUrl?: string;
    },
  ): Promise<void> {
    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel: NotificationChannel.IN_APP,
      priority: NotificationPriority.MEDIUM,
      title: 'New Task Assigned',
      message: `${variables.assignerName} assigned you a task: "${variables.taskTitle}"${variables.dueDate ? ` (Due: ${variables.dueDate})` : ''}`,
      recipientId,
      tenantId,
      actionData: variables.taskUrl
        ? {
            url: variables.taskUrl,
            buttonText: 'View Task',
            actionType: 'navigate',
          }
        : undefined,
      metadata: {
        type: 'task_assignment',
        taskTitle: variables.taskTitle,
        assignerName: variables.assignerName,
      },
    });
  }
  async sendMeetingReminderNotification(
    recipientIds: string[],
    tenantId: string,
    variables: {
      meetingTitle: string;
      startTime: string;
      meetingUrl?: string;
      organizerName: string;
    },
  ): Promise<void> {
    await this.notificationService.createBulkNotifications({
      recipientIds,
      channel: NotificationChannel.BOTH,
      priority: NotificationPriority.HIGH,
      title: 'Meeting Reminder',
      message: `Reminder: "${variables.meetingTitle}" starts at ${variables.startTime}`,
      tenantId,
      actionData: variables.meetingUrl
        ? {
            url: variables.meetingUrl,
            buttonText: 'Join Meeting',
            actionType: 'external_link',
          }
        : undefined,
      metadata: {
        type: 'meeting_reminder',
        meetingTitle: variables.meetingTitle,
        organizerName: variables.organizerName,
      },
    });
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
      title: `Document ${variables.status === 'approved' ? 'Approved' : variables.status === 'rejected' ? 'Rejected' : 'Under Review'}`,
      message: `Your document "${variables.documentName}" ${statusMessages[variables.status]} by ${variables.reviewerName}${variables.comments ? `. Comments: ${variables.comments}` : ''}`,
      recipientId,
      tenantId,
      actionData: variables.documentUrl
        ? {
            url: variables.documentUrl,
            buttonText: 'View Document',
            actionType: 'navigate',
          }
        : undefined,
      metadata: {
        type: 'document_approval',
        documentName: variables.documentName,
        status: variables.status,
        reviewerName: variables.reviewerName,
      },
    });
  }
  async sendBirthdayNotification(
    tenantId: string,
    variables: {
      birthdayPersonName: string;
      birthdayPersonId: string;
    },
  ): Promise<void> {
    await this.notificationService.sendTenantNotification(
      tenantId,
      '🎉 Birthday Today!',
      `It's ${variables.birthdayPersonName}'s birthday today! Don't forget to wish them well.`,
      NotificationChannel.IN_APP,
      {
        type: 'birthday',
        birthdayPersonName: variables.birthdayPersonName,
        birthdayPersonId: variables.birthdayPersonId,
      },
    );
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
      title: 'Security Alert',
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
