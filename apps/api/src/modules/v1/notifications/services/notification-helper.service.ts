import { Injectable } from '@nestjs/common';

import { NotificationChannel } from '../../../../common/enums/notification-channel.enum';
import type { NotificationPreferenceType } from '../../../../common/enums/notification-preference-type.enum';
import { NotificationPriority } from '../../../../common/enums/notification-priority.enum';
import { NotificationType } from '../../../../common/enums/notification-type.enum';
import { NotificationService } from './notification.service';
import { NotificationPreferenceService } from './notification-preference.service';

@Injectable()
export class NotificationHelperService {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly preferenceService: NotificationPreferenceService,
  ) {}

  private async shouldSend(
    recipientId: string,
    notificationType: NotificationPreferenceType,
    channel: NotificationChannel,
  ): Promise<boolean> {
    try {
      return await this.preferenceService.shouldSendNotification(
        recipientId,
        notificationType,
        channel,
      );
    } catch {
      return true;
    }
  }

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
      actionData: variables.ctaUrl
        ? { url: variables.ctaUrl, buttonText: 'Get Started', actionType: 'navigate' }
        : undefined,
    });
  }

  async sendInvitationNotification(
    email: string,
    variables: { inviterName: string; tenantName: string; inviteLink: string },
  ): Promise<void> {
    // Invitations are sent via email only, no in-app bell.
  }

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
      title: 'New task assigned',
      message: `${variables.assignerName} assigned you a task: "${variables.taskTitle}"${variables.dueDate ? ` (Due: ${variables.dueDate})` : ''}`,
      recipientId,
      tenantId,
      actionData: variables.taskUrl
        ? { url: variables.taskUrl, buttonText: 'View Task', actionType: 'navigate' }
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
      title: 'Meeting reminder',
      message: `Reminder: "${variables.meetingTitle}" starts at ${variables.startTime}`,
      tenantId,
      actionData: variables.meetingUrl
        ? { url: variables.meetingUrl, buttonText: 'Join Meeting', actionType: 'external_link' }
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

  async sendRewardRedemptionNotification(
    recipientId: string,
    tenantId: string,
    variables: {
      rewardName: string;
      status: 'processing' | 'fulfilled' | 'failed';
      points?: number;
      failureReason?: string;
    },
  ): Promise<void> {
    const statusMessages = {
      processing: 'is being processed',
      fulfilled: 'has been fulfilled',
      failed: 'could not be completed',
    };

    const pointsText = variables.points ? ` (${variables.points} Paq points)` : '';
    const failureText = variables.failureReason ? ` Reason: ${variables.failureReason}` : '';

    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel:
        variables.status === 'processing' ? NotificationChannel.IN_APP : NotificationChannel.BOTH,
      priority:
        variables.status === 'failed' ? NotificationPriority.HIGH : NotificationPriority.MEDIUM,
      title: `Reward ${variables.status}`,
      message: `Your reward "${variables.rewardName}" ${statusMessages[variables.status]}${pointsText}.${variables.status === 'failed' ? failureText : ''}`,
      recipientId,
      tenantId,
      metadata: {
        type: 'reward_redemption',
        rewardName: variables.rewardName,
        status: variables.status,
      },
    });
  }

  async sendNewTeamMemberNotification(
    tenantId: string,
    variables: {
      newMemberName: string;
      department?: string;
      role?: string;
    },
  ): Promise<void> {
    const departmentText = variables.department ? ` in ${variables.department}` : '';
    const roleText = variables.role ? ` as ${variables.role}` : '';

    await this.notificationService.sendTenantNotification(
      tenantId,
      'New team member',
      `${variables.newMemberName} has joined${departmentText}${roleText}. Say hello!`,
      NotificationChannel.IN_APP,
      {
        type: 'new_team_member',
        newMemberName: variables.newMemberName,
        department: variables.department,
        role: variables.role,
      },
    );
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
      'Birthday today!',
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

  async sendProfileUpdatedNotification(
    recipientId: string,
    tenantId: string,
    variables: {
      updatedFields: string[];
      updatedBy: string;
    },
  ): Promise<void> {
    const fields = variables.updatedFields.join(', ');
    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel: NotificationChannel.BOTH,
      priority: NotificationPriority.LOW,
      title: 'Profile updated',
      message: `Your profile was updated by ${variables.updatedBy}. Fields changed: ${fields}`,
      recipientId,
      tenantId,
      metadata: {
        type: 'profile_updated',
        updatedFields: variables.updatedFields,
        updatedBy: variables.updatedBy,
      },
    });
  }

  async sendPointsAwardedNotification(
    recipientId: string,
    tenantId: string,
    variables: {
      points: number;
      awardedBy: string;
      reason?: string;
    },
  ): Promise<void> {
    const channel = NotificationChannel.IN_APP;
    if (!(await this.shouldSend(recipientId, 'shoutout' as NotificationPreferenceType, channel))) {
      return;
    }
    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel,
      priority: NotificationPriority.LOW,
      title: 'Paq points awarded',
      message: `${variables.awardedBy} awarded you ${variables.points} Paq points${variables.reason ? `: ${variables.reason}` : ''}`,
      recipientId,
      tenantId,
      metadata: {
        type: 'points_awarded',
        points: variables.points,
        awardedBy: variables.awardedBy,
        reason: variables.reason ?? null,
      },
    });
  }

  async sendTaskCompletionPointsNotification(
    recipientId: string,
    tenantId: string,
    variables: {
      points: number;
      taskTitle: string;
    },
  ): Promise<void> {
    const channel = NotificationChannel.IN_APP;
    if (
      !(await this.shouldSend(
        recipientId,
        'task_assignment' as NotificationPreferenceType,
        channel,
      ))
    ) {
      return;
    }
    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel,
      priority: NotificationPriority.LOW,
      title: 'Task completed',
      message: `You earned ${variables.points} Paq points for completing "${variables.taskTitle}"`,
      recipientId,
      tenantId,
      metadata: {
        type: 'task_completion_points',
        points: variables.points,
        taskTitle: variables.taskTitle,
      },
    });
  }

  async sendInvitationDeclinedNotification(
    recipientId: string,
    tenantId: string,
    variables: {
      inviteeEmail: string;
    },
  ): Promise<void> {
    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel: NotificationChannel.IN_APP,
      priority: NotificationPriority.LOW,
      title: 'Invitation declined',
      message: `${variables.inviteeEmail} declined the invitation to join the workspace.`,
      recipientId,
      tenantId,
      metadata: {
        type: 'invitation_declined',
        inviteeEmail: variables.inviteeEmail,
      },
    });
  }

  async sendAttendanceExceptionNotification(
    recipientId: string,
    tenantId: string,
    variables: {
      status: 'approved' | 'rejected';
      exceptionType: string;
      date: string;
      reviewerName?: string;
      comments?: string;
    },
  ): Promise<void> {
    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel: NotificationChannel.IN_APP,
      priority: NotificationPriority.LOW,
      title: `Attendance exception ${variables.status}`,
      message: `Your ${variables.exceptionType.toLowerCase()} exception for ${variables.date} was ${variables.status}.${variables.comments ? ` Comment: ${variables.comments}` : ''}`,
      recipientId,
      tenantId,
      metadata: {
        type: 'attendance_exception',
        status: variables.status,
        exceptionType: variables.exceptionType,
        date: variables.date,
        reviewerName: variables.reviewerName ?? null,
        comments: variables.comments ?? null,
      },
    });
  }

  async sendPaymentMethodSubmittedAdminNotification(
    recipientIds: string[],
    tenantId: string,
    variables: {
      employeeName: string;
      currency: string;
      paymentMethodId: string;
    },
  ): Promise<void> {
    if (recipientIds.length === 0) return;
    await this.notificationService.createBulkNotifications({
      recipientIds,
      tenantId,
      channel: NotificationChannel.IN_APP,
      priority: NotificationPriority.MEDIUM,
      title: `Payment details to review: ${variables.employeeName}`,
      message: `${variables.employeeName} submitted a ${variables.currency} payment account for verification.`,
      metadata: {
        type: 'payment_method_review',
        status: 'pending_verification',
        paymentMethodId: variables.paymentMethodId,
        currency: variables.currency,
      },
    });
  }

  async sendPaymentMethodSubmittedEmployeeNotification(
    recipientId: string,
    tenantId: string,
    variables: {
      currency: string;
      paymentMethodId: string;
    },
  ): Promise<void> {
    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel: NotificationChannel.IN_APP,
      priority: NotificationPriority.LOW,
      title: 'Payment details submitted for review',
      message: `Your ${variables.currency} payment account was submitted for admin verification.`,
      recipientId,
      tenantId,
      metadata: {
        type: 'payment_method_review',
        status: 'pending_verification',
        paymentMethodId: variables.paymentMethodId,
        currency: variables.currency,
      },
    });
  }

  async sendPaymentMethodVerifiedNotification(
    recipientId: string,
    tenantId: string,
    variables: {
      currency: string;
      paymentMethodId: string;
    },
  ): Promise<void> {
    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel: NotificationChannel.IN_APP,
      priority: NotificationPriority.MEDIUM,
      title: 'Payment account verified',
      message: `Your ${variables.currency} payment account was approved and is ready for payroll.`,
      recipientId,
      tenantId,
      metadata: {
        type: 'payment_method_review',
        status: 'verified',
        paymentMethodId: variables.paymentMethodId,
        currency: variables.currency,
      },
    });
  }

  async sendPaymentMethodRejectedNotification(
    recipientId: string,
    tenantId: string,
    variables: {
      currency: string;
      reason: string;
      paymentMethodId: string;
    },
  ): Promise<void> {
    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel: NotificationChannel.IN_APP,
      priority: NotificationPriority.HIGH,
      title: 'Payment account rejected',
      message: `Your ${variables.currency} payment account was rejected. Reason: ${variables.reason}`,
      recipientId,
      tenantId,
      metadata: {
        type: 'payment_method_review',
        status: 'rejected',
        paymentMethodId: variables.paymentMethodId,
        currency: variables.currency,
      },
    });
  }
}
