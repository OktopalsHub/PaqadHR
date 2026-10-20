import { Injectable, Logger, Optional } from '@nestjs/common';
import { TenantMemberRole } from 'src/common/enums/tenant-member.enum';
import type { AuditContext } from 'src/common/interfaces/audit-context.interface';
import { NotificationHelperService } from '../../notifications/services/notification-helper.service';
import { ZeptomailEmailService } from '../../notifications/services/zeptomail-email.service';
import { escapeHtml } from '../../notifications/templates/brand';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import type { PayrollItem } from '../entities/payroll-item.entity';
import { AuditService } from './audit.service';
import { PayrollExportService } from './payroll-export.service';

type RunNotifyContext = {
  id: string;
  title: string;
  tenantId: string;
  periodStart?: string | Date | null;
  periodEnd?: string | Date | null;
  baseCurrency?: string | null;
  paymentDate?: string | Date | null;
};

@Injectable()
export class PayrollLifecycleNotifyService {
  private readonly logger = new Logger(PayrollLifecycleNotifyService.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly tenantMembersService: TenantMembersService,
    @Optional() private readonly notifications?: NotificationHelperService,
    @Optional() private readonly payrollExportService?: PayrollExportService,
    @Optional() private readonly emailService?: ZeptomailEmailService,
  ) {}

  async notifyPaymentSetup(input: {
    tenantId: string;
    memberId: string;
    employeeName: string;
    payrollPeriod: string;
    auditContext?: AuditContext;
  }): Promise<void> {
    if (this.notifications) {
      await this.notifications.sendPayrollPaymentSetupReminder(input.memberId, input.tenantId, {
        employeeName: input.employeeName,
        payrollPeriod: input.payrollPeriod,
        message: 'please add your payment details so you can be included in payroll.',
      });
    }
    if (input.auditContext) {
      await this.auditService.logPaymentSetupNotified(input.auditContext, {
        memberId: input.memberId,
        employeeName: input.employeeName,
      });
    }
  }

  async onItemPaid(input: {
    tenantId: string;
    item: PayrollItem;
    run?: RunNotifyContext | null;
    auditContext?: AuditContext;
  }): Promise<void> {
    const employeeName = this.employeeName(input.item);
    const period = this.periodLabel(input.run);
    const amount = Number(input.item.paymentAmount ?? input.item.netAmount ?? 0);
    const currency = (input.item.paymentCurrency || input.run?.baseCurrency || 'NGN').toUpperCase();

    try {
      if (this.notifications) {
        await this.notifications.sendPayrollNotification(input.item.memberId, input.tenantId, {
          employeeName,
          payrollPeriod: period,
          amount,
          currency,
        });
      }
    } catch (error) {
      this.logger.warn(
        `Paid notification failed for item ${input.item.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    if (input.auditContext) {
      await this.auditService.logPaymentSent(
        { ...input.auditContext, memberId: input.item.memberId },
        {
          paymentAmount: amount,
          paymentCurrency: currency,
          paymentProvider: input.item.paymentProvider,
          transactionId: input.item.transactionId,
          employeeName,
        },
      );
    }
  }

  async onItemFailed(input: {
    tenantId: string;
    item: PayrollItem;
    run?: RunNotifyContext | null;
    reason: string;
    auditContext?: AuditContext;
  }): Promise<void> {
    const employeeName = this.employeeName(input.item);
    const title = input.run?.title ?? 'Payroll';

    try {
      const adminIds = await this.listAdminMemberIds(input.tenantId);
      if (this.notifications && adminIds.length > 0) {
        await this.notifications.sendPayrollPayoutFailedAdminNotification(
          adminIds,
          input.tenantId,
          { employeeName, title, reason: input.reason },
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed-payout admin notification failed for item ${input.item.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    if (input.auditContext) {
      await this.auditService.logPaymentFailed(
        { ...input.auditContext, memberId: input.item.memberId },
        {
          paymentAmount: input.item.paymentAmount,
          paymentCurrency: input.item.paymentCurrency,
          paymentProvider: input.item.paymentProvider,
          employeeName,
        },
        input.reason,
      );
    }
  }

  async onPayslipsPublished(input: {
    tenantId: string;
    run: RunNotifyContext;
    items: PayrollItem[];
    sendEmail: boolean;
    tenantSlug?: string | null;
  }): Promise<void> {
    if (!input.sendEmail) return;
    const period = this.periodLabel(input.run);
    for (const item of input.items) {
      try {
        if (!this.notifications) continue;
        await this.notifications.sendPayslipPublishedNotification(item.memberId, input.tenantId, {
          employeeName: this.employeeName(item),
          payrollPeriod: period,
          payrollRunId: input.run.id,
        });
      } catch (error) {
        this.logger.warn(
          `Payslip notification failed for item ${item.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    // PDFs are generated and emailed off the request path: publishing must not wait on one
    // provider call per employee, and a slow mail provider must not fail the publish.
    this.queuePayslipEmails(input, period);
  }

  private queuePayslipEmails(
    input: {
      tenantId: string;
      run: RunNotifyContext;
      items: PayrollItem[];
    },
    period: string,
  ): void {
    if (!this.payrollExportService || !this.emailService || input.items.length === 0) return;
    void this.sendPayslipEmails(input, period).catch((error) => {
      this.logger.warn(
        `Payslip email batch failed for run ${input.run.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }

  private async sendPayslipEmails(
    input: {
      tenantId: string;
      run: RunNotifyContext;
      items: PayrollItem[];
    },
    period: string,
  ): Promise<void> {
    for (const item of input.items) {
      try {
        const member = await this.tenantMembersService.getTenantMember(
          item.memberId,
          input.tenantId,
        );
        const email = member.user?.email;
        if (!email) {
          this.logger.warn(`No email on file for payslip recipient of item ${item.id}`);
          continue;
        }

        const employeeName = this.employeeName(item);
        const currency = (item.paymentCurrency || input.run.baseCurrency || '').toUpperCase();
        const amount = Number(item.paymentAmount ?? item.netAmount ?? 0);
        const pdf = await this.payrollExportService!.renderPayslipPdf(input.run, item);
        const result = await this.emailService!.sendEmail({
          to: email,
          subject: `Your payslip for ${period}`,
          html: `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#18181b;line-height:1.5">
  <p>Hi ${escapeHtml(employeeName)},</p>
  <p>Your payslip for <strong>${escapeHtml(period)}</strong> is attached to this email.</p>
  <p>Net pay: <strong>${escapeHtml(currency)} ${escapeHtml(amount.toLocaleString())}</strong></p>
  <p style="color:#71717a;font-size:12px">This payslip was sent by PaqadHR on behalf of your employer.</p>
</div>`,
          text: `Hi ${employeeName},\n\nYour payslip for ${period} is attached to this email.\nNet pay: ${currency} ${amount.toLocaleString()}\n\nThis payslip was sent by PaqadHR on behalf of your employer.`,
          attachments: [
            {
              filename: `payslip-${period.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}.pdf`,
              content: pdf,
              contentType: 'application/pdf',
            },
          ],
        });
        if (!result.success) {
          this.logger.warn(
            `Payslip email failed for item ${item.id}: ${result.error ?? 'unknown error'}`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Payslip email failed for item ${item.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  async onPayrollApproved(input: {
    tenantId: string;
    run: RunNotifyContext;
    actorMemberId?: string;
  }): Promise<void> {
    if (!this.notifications) return;
    try {
      const adminIds = (await this.listAdminMemberIds(input.tenantId)).filter(
        (id) => id !== input.actorMemberId,
      );
      if (adminIds.length === 0) return;
      await this.notifications.sendPayrollApprovedAdminNotification(adminIds, input.tenantId, {
        title: input.run.title,
        period: this.periodLabel(input.run),
      });
    } catch (error) {
      this.logger.warn(
        `Approve admin notification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onPayrollScheduled(input: {
    tenantId: string;
    run: RunNotifyContext;
    paymentDate: string;
    auditContext: AuditContext;
  }): Promise<void> {
    await this.auditService.logPayrollScheduled(input.auditContext, {
      title: input.run.title,
      paymentDate: input.paymentDate,
    });
    if (!this.notifications) return;
    try {
      const adminIds = await this.listAdminMemberIds(input.tenantId);
      await this.notifications.sendPayrollScheduledAdminNotification(adminIds, input.tenantId, {
        title: input.run.title,
        paymentDate: input.paymentDate,
      });
    } catch (error) {
      this.logger.warn(
        `Schedule admin notification failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async onScheduledPayoutDue(input: { tenantId: string; run: RunNotifyContext }): Promise<void> {
    if (!this.notifications) return;
    try {
      const adminIds = await this.listAdminMemberIds(input.tenantId);
      const paymentDate = input.run.paymentDate
        ? String(input.run.paymentDate).slice(0, 10)
        : 'today';
      await this.notifications.sendPayrollScheduledDueAdminNotification(adminIds, input.tenantId, {
        title: input.run.title,
        paymentDate,
      });
    } catch (error) {
      this.logger.warn(
        `Scheduled-due admin notification failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Employee name for notification copy. Never returns a raw member UUID — ids are internal
   * identifiers and leak implementation detail into user-facing email. Callers that can load
   * the `employee` relation should do so; this is the last-resort wording for when they did not.
   */
  private employeeName(item: PayrollItem): string {
    const employee = item.employee;
    if (!employee) return 'an employee';
    return `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim() || 'an employee';
  }

  private periodLabel(run?: RunNotifyContext | null): string {
    if (!run) return 'this period';
    const start = run.periodStart ? String(run.periodStart).slice(0, 10) : '';
    const end = run.periodEnd ? String(run.periodEnd).slice(0, 10) : '';
    const range = `${start} – ${end}`.trim();
    if (range !== '–' && range.length > 1) return range;
    return run.title;
  }

  private async listAdminMemberIds(tenantId: string): Promise<string[]> {
    const members = await this.tenantMembersService.listActiveTenantMembers(tenantId);
    return members
      .filter(
        (member) =>
          member.role === TenantMemberRole.OWNER || member.role === TenantMemberRole.ADMIN,
      )
      .map((member) => member.id);
  }
}
