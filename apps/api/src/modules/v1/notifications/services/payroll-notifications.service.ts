import { Injectable } from '@nestjs/common';
import { NotificationChannel } from '../../../../common/enums/notification-channel.enum';
import { NotificationPriority } from '../../../../common/enums/notification-priority.enum';
import { NotificationType } from '../../../../common/enums/notification-type.enum';
import { NotificationService } from './notification.service';

@Injectable()
export class PayrollNotificationsService {
  constructor(private readonly notificationService: NotificationService) {}

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
