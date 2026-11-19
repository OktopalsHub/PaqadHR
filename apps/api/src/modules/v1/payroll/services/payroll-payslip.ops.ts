import { ForbiddenException, Injectable } from '@nestjs/common';

import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { AuditContext } from '../../../../common/interfaces/audit-context.interface';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { PayrollAccessGuard } from './payroll-access-guard';
import { PayrollLifecycleNotifyService } from './payroll-lifecycle-notify.service';
import { PayrollRunOps } from './payroll-run.ops';
import { PayrollRunService } from './payroll-run.service';

@Injectable()
export class PayrollPayslipOps {
  constructor(
    private readonly payrollRunService: PayrollRunService,
    private readonly accessGuard: PayrollAccessGuard,
    private readonly payrollItemRepository: PayrollItemRepository,
    private readonly tenantMembersService: TenantMembersService,
    private readonly lifecycleNotify: PayrollLifecycleNotifyService,
    private readonly runs: PayrollRunOps,
  ) {}

  // --- Payslip methods ---
  async getRunPayslips(payrollRunId: string, tenantId: string) {
    return this.payrollRunService.getRunPayslips(payrollRunId, tenantId);
  }

  async publishPayslips(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
    itemIds?: string[],
    sendEmail?: boolean,
    requesterMemberId?: string,
    requesterRole?: string,
  ) {
    return this.payrollRunService.publishPayslips(
      payrollRunId,
      tenantId,
      auditContext,
      itemIds,
      sendEmail,
      requesterMemberId,
      requesterRole,
    );
  }

  async notifyEmployeePaymentSetup(
    payrollRunId: string,
    itemId: string,
    tenantId: string,
    requesterMemberId?: string,
    requesterRole?: string,
  ) {
    const result = await this.payrollRunService.notifyEmployeePaymentSetup(
      payrollRunId,
      itemId,
      tenantId,
      requesterMemberId,
      requesterRole,
    );
    const run = await this.payrollRunService.getPayrollRun(payrollRunId, tenantId);
    const item = run?.items?.find((entry) => entry.id === itemId);
    if (!item) return result;
    const employee = item.employee;
    const employeeName =
      `${employee?.firstName ?? ''} ${employee?.lastName ?? ''}`.trim() || 'there';
    await this.lifecycleNotify.notifyPaymentSetup({
      tenantId,
      memberId: item.memberId,
      employeeName,
      payrollPeriod: `${run?.periodStart ?? ''} – ${run?.periodEnd ?? ''}`,
      auditContext: {
        tenantId,
        payrollRunId,
        performedById: requesterMemberId ?? '',
        memberId: item.memberId,
      },
    });
    return result;
  }

  async notifyMemberPaymentSetup(
    tenantId: string,
    memberId: string,
    requesterRole: string,
    requesterMemberId?: string,
  ) {
    if (!this.runs.isPayrollAdmin(requesterRole)) {
      throw new ForbiddenException('Admin access required');
    }
    const member = await this.tenantMembersService.getTenantMember(memberId, tenantId);
    const employeeName = `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim() || 'there';
    await this.lifecycleNotify.notifyPaymentSetup({
      tenantId,
      memberId,
      employeeName,
      payrollPeriod: 'upcoming payroll',
      auditContext: {
        tenantId,
        performedById: requesterMemberId ?? memberId,
        memberId,
      },
    });
    return { notified: true, memberId };
  }

  async getMemberPublishedPayslips(
    memberId: string,
    tenantId: string,
    requesterMemberId: string,
    requesterRole: string,
  ) {
    await this.accessGuard.assertPayrollMemberAccess(
      tenantId,
      memberId,
      requesterMemberId,
      requesterRole,
    );
    const items = await this.payrollItemRepository.find({
      where: { memberId, status: PayrollItemStatus.PAID },
      relations: { payrollRun: true, employee: true },
      order: { paidAt: 'DESC' },
    });
    return items
      .filter((i) => i.payrollRun?.tenantId === tenantId && Boolean(i.metadata?.payslipPublished))
      .map((i) => ({
        itemId: i.id,
        runId: i.payrollRunId,
        memberId: i.memberId,
        employeeName: i.employee
          ? `${i.employee.firstName ?? ''} ${i.employee.lastName ?? ''}`.trim() || 'Unknown'
          : i.memberId,
        runTitle: i.payrollRun?.title,
        periodStart: i.payrollRun?.periodStart,
        periodEnd: i.payrollRun?.periodEnd,
        netAmount: i.netAmount,
        currency: i.payrollRun?.baseCurrency,
        paidAt: i.paidAt,
        publishedAt: i.metadata?.payslipPublishedAt as string | undefined,
      }));
  }
}
