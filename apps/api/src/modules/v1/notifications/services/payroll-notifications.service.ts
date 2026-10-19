import { Injectable } from '@nestjs/common';
import { NotificationChannel } from '../../../../common/enums/notification-channel.enum';
import { NotificationPriority } from '../../../../common/enums/notification-priority.enum';
import { NotificationType } from '../../../../common/enums/notification-type.enum';
import { NotificationService } from './notification.service';
import { TenantNameService } from './tenant-name.service';

@Injectable()
export class PayrollNotificationsService {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly tenantNameService: TenantNameService,
  ) {}

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
    // Name the organization that paid the salary: a member must see their employer's name on the
    // payroll notice, not only the platform that processed it.
    const organizationName = await this.tenantNameService.resolve(tenantId);
    const payer = organizationName ? ` from ${organizationName}` : '';
    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel: NotificationChannel.BOTH,
      priority: NotificationPriority.HIGH,
      title: 'Payroll Processed',
      message: `Hi ${variables.employeeName}, your payroll for ${variables.payrollPeriod}${payer} has been processed. Amount: ${variables.currency} ${variables.amount}`,
      recipientId,
      tenantId,
      metadata: {
        type: 'payroll_processed',
        ...(organizationName ? { organizationName } : {}),
      },
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
    const organizationName = await this.tenantNameService.resolve(tenantId);
    const payer = organizationName ? ` from ${organizationName}` : '';
    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel: NotificationChannel.BOTH,
      priority: NotificationPriority.HIGH,
      title: 'Your payslip is ready',
      message: `Hi ${variables.employeeName}, your payslip for ${variables.payrollPeriod}${payer} is ready to download.`,
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
        ...(organizationName ? { organizationName } : {}),
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

  async sendPayrollApprovedAdminNotification(
    recipientIds: string[],
    tenantId: string,
    variables: { title: string; period: string },
  ): Promise<void> {
    if (recipientIds.length === 0) return;
    await this.notificationService.createBulkNotifications({
      recipientIds,
      tenantId,
      channel: NotificationChannel.IN_APP,
      priority: NotificationPriority.MEDIUM,
      title: 'Payroll approved',
      message: `${variables.title} (${variables.period}) is approved and ready to pay.`,
      metadata: { type: 'payroll_approved' },
    });
  }

  async sendPayrollPayoutFailedAdminNotification(
    recipientIds: string[],
    tenantId: string,
    variables: { employeeName: string; title: string; reason: string },
  ): Promise<void> {
    if (recipientIds.length === 0) return;
    await this.notificationService.createBulkNotifications({
      recipientIds,
      tenantId,
      channel: NotificationChannel.BOTH,
      priority: NotificationPriority.HIGH,
      title: 'Payroll payment failed',
      message: `Payment to ${variables.employeeName} for ${variables.title} failed: ${variables.reason}`,
      metadata: { type: 'payroll_payment_failed' },
    });
  }

  async sendPayrollScheduledAdminNotification(
    recipientIds: string[],
    tenantId: string,
    variables: { title: string; paymentDate: string },
  ): Promise<void> {
    if (recipientIds.length === 0) return;
    await this.notificationService.createBulkNotifications({
      recipientIds,
      tenantId,
      channel: NotificationChannel.IN_APP,
      priority: NotificationPriority.MEDIUM,
      title: 'Payroll scheduled',
      message: `${variables.title} is scheduled for ${variables.paymentDate}.`,
      metadata: { type: 'payroll_scheduled' },
    });
  }

  async sendPayrollScheduledDueAdminNotification(
    recipientIds: string[],
    tenantId: string,
    variables: { title: string; paymentDate: string },
  ): Promise<void> {
    if (recipientIds.length === 0) return;
    await this.notificationService.createBulkNotifications({
      recipientIds,
      tenantId,
      channel: NotificationChannel.BOTH,
      priority: NotificationPriority.HIGH,
      title: 'Scheduled payroll is due',
      message: `${variables.title} is due (${variables.paymentDate}) and payout is starting.`,
      metadata: { type: 'payroll_scheduled_due' },
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
