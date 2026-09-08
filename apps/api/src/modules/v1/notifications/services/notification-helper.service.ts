import { Injectable } from '@nestjs/common';
import { EngagementNotificationsService } from './engagement-notifications.service';
import { LeaveNotificationsService } from './leave-notifications.service';
import { MemberNotificationsService } from './member-notifications.service';
import { PayrollNotificationsService } from './payroll-notifications.service';
import { SystemNotificationsService } from './system-notifications.service';

@Injectable()
export class NotificationHelperService {
  constructor(
    private readonly memberNotifications: MemberNotificationsService,
    private readonly payrollNotifications: PayrollNotificationsService,
    private readonly leaveNotifications: LeaveNotificationsService,
    private readonly engagementNotifications: EngagementNotificationsService,
    private readonly systemNotifications: SystemNotificationsService,
  ) {}

  async sendWelcomeNotification(
    recipientId: string,
    tenantId: string,
    variables: { name: string; tenantName: string; ctaUrl?: string },
  ): Promise<void> {
    return this.memberNotifications.sendWelcomeNotification(recipientId, tenantId, variables);
  }

  async sendInvitationNotification(
    email: string,
    variables: { inviterName: string; tenantName: string; inviteLink: string },
  ): Promise<void> {
    return this.memberNotifications.sendInvitationNotification(email, variables);
  }

  async sendPayrollNotification(
    recipientId: string,
    tenantId: string,
    variables: { employeeName: string; payrollPeriod: string; amount: number; currency: string },
  ): Promise<void> {
    return this.payrollNotifications.sendPayrollNotification(recipientId, tenantId, variables);
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
    return this.payrollNotifications.sendPayslipPublishedNotification(
      recipientId,
      tenantId,
      variables,
    );
  }

  async sendPayrollPaymentSetupReminder(
    recipientId: string,
    tenantId: string,
    variables: { employeeName: string; payrollPeriod: string; message: string },
  ): Promise<void> {
    return this.payrollNotifications.sendPayrollPaymentSetupReminder(
      recipientId,
      tenantId,
      variables,
    );
  }

  async sendBillingRenewalFailedNotification(
    recipientId: string,
    tenantId: string,
    variables: { tenantName: string; reason: string; status: string },
  ): Promise<void> {
    return this.systemNotifications.sendBillingRenewalFailedNotification(
      recipientId,
      tenantId,
      variables,
    );
  }

  async sendLeaveRequestNotification(
    recipientId: string,
    tenantId: string,
    variables: { status: string; startDate: string; endDate: string; requesterName?: string },
  ): Promise<void> {
    return this.leaveNotifications.sendLeaveRequestNotification(recipientId, tenantId, variables);
  }

  async sendLeaveBalanceUpdatedNotification(
    recipientId: string,
    tenantId: string,
    variables: { leaveTypeName: string; remainingDays: number; reason: string },
  ): Promise<void> {
    return this.leaveNotifications.sendLeaveBalanceUpdatedNotification(
      recipientId,
      tenantId,
      variables,
    );
  }

  async sendShoutoutNotification(
    recipientId: string,
    tenantId: string,
    variables: { senderName: string; message: string; points?: number },
  ): Promise<void> {
    return this.engagementNotifications.sendShoutoutNotification(recipientId, tenantId, variables);
  }

  async sendSystemAnnouncement(
    title: string,
    message: string,
    tenantId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    return this.systemNotifications.sendSystemAnnouncement(title, message, tenantId, metadata);
  }

  async sendTaskAssignmentNotification(
    recipientId: string,
    tenantId: string,
    variables: { taskTitle: string; assignerName: string; dueDate?: string; taskUrl?: string },
  ): Promise<void> {
    return this.engagementNotifications.sendTaskAssignmentNotification(
      recipientId,
      tenantId,
      variables,
    );
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
    return this.engagementNotifications.sendMeetingReminderNotification(
      recipientIds,
      tenantId,
      variables,
    );
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
    return this.systemNotifications.sendDocumentApprovalNotification(
      recipientId,
      tenantId,
      variables,
    );
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
    return this.engagementNotifications.sendRewardRedemptionNotification(
      recipientId,
      tenantId,
      variables,
    );
  }

  async sendNewTeamMemberNotification(
    tenantId: string,
    variables: { newMemberName: string; department?: string; role?: string },
  ): Promise<void> {
    return this.memberNotifications.sendNewTeamMemberNotification(tenantId, variables);
  }

  async sendBirthdayNotification(
    tenantId: string,
    variables: { birthdayPersonName: string; birthdayPersonId: string },
  ): Promise<void> {
    return this.memberNotifications.sendBirthdayNotification(tenantId, variables);
  }

  async sendSecurityAlertNotification(
    recipientId: string,
    tenantId: string,
    variables: { alertType: string; description: string; ipAddress?: string; timestamp: string },
  ): Promise<void> {
    return this.systemNotifications.sendSecurityAlertNotification(recipientId, tenantId, variables);
  }

  async sendProfileUpdatedNotification(
    recipientId: string,
    tenantId: string,
    variables: { updatedFields: string[]; updatedBy: string },
  ): Promise<void> {
    return this.memberNotifications.sendProfileUpdatedNotification(
      recipientId,
      tenantId,
      variables,
    );
  }

  async sendPointsAwardedNotification(
    recipientId: string,
    tenantId: string,
    variables: { points: number; awardedBy: string; reason?: string },
  ): Promise<void> {
    return this.engagementNotifications.sendPointsAwardedNotification(
      recipientId,
      tenantId,
      variables,
    );
  }

  async sendTaskCompletionPointsNotification(
    recipientId: string,
    tenantId: string,
    variables: { points: number; taskTitle: string },
  ): Promise<void> {
    return this.engagementNotifications.sendTaskCompletionPointsNotification(
      recipientId,
      tenantId,
      variables,
    );
  }

  async sendInvitationDeclinedNotification(
    recipientId: string,
    tenantId: string,
    variables: { inviteeEmail: string },
  ): Promise<void> {
    return this.memberNotifications.sendInvitationDeclinedNotification(
      recipientId,
      tenantId,
      variables,
    );
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
    return this.memberNotifications.sendAttendanceExceptionNotification(
      recipientId,
      tenantId,
      variables,
    );
  }

  async sendPaymentMethodSubmittedAdminNotification(
    recipientIds: string[],
    tenantId: string,
    variables: { employeeName: string; currency: string; paymentMethodId: string },
  ): Promise<void> {
    return this.payrollNotifications.sendPaymentMethodSubmittedAdminNotification(
      recipientIds,
      tenantId,
      variables,
    );
  }

  async sendPaymentMethodSubmittedEmployeeNotification(
    recipientId: string,
    tenantId: string,
    variables: { currency: string; paymentMethodId: string },
  ): Promise<void> {
    return this.payrollNotifications.sendPaymentMethodSubmittedEmployeeNotification(
      recipientId,
      tenantId,
      variables,
    );
  }

  async sendPaymentMethodVerifiedNotification(
    recipientId: string,
    tenantId: string,
    variables: { currency: string; paymentMethodId: string },
  ): Promise<void> {
    return this.payrollNotifications.sendPaymentMethodVerifiedNotification(
      recipientId,
      tenantId,
      variables,
    );
  }

  async sendPaymentMethodRejectedNotification(
    recipientId: string,
    tenantId: string,
    variables: { currency: string; reason: string; paymentMethodId: string },
  ): Promise<void> {
    return this.payrollNotifications.sendPaymentMethodRejectedNotification(
      recipientId,
      tenantId,
      variables,
    );
  }
}
