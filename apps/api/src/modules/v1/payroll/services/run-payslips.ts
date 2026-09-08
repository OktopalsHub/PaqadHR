import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { TenantMemberRole } from '../../../../common/enums';
import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import type { AuditContext } from '../../../../common/interfaces/audit-context.interface';
import { ManagerAccessService } from '../../../../common/services/manager-access.service';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { AuditService } from './audit.service';

@Injectable()
export class RunPayslips {
  constructor(
    private readonly payrollRunRepository: PayrollRunRepository,
    private readonly payrollItemRepository: PayrollItemRepository,
    private readonly auditService: AuditService,
    private readonly managerAccessService: ManagerAccessService,
  ) {}

  isPayrollAdmin(role: string): boolean {
    return role === TenantMemberRole.ADMIN || role === TenantMemberRole.OWNER;
  }

  async assertManagerOrAdmin(
    tenantId: string,
    requesterMemberId: string,
    requesterRole: string,
  ): Promise<string[]> {
    if (this.isPayrollAdmin(requesterRole)) return [];
    const directReports = await this.managerAccessService.getDirectReportIds(
      tenantId,
      requesterMemberId,
    );
    if (directReports.length === 0)
      throw new ForbiddenException('Admin or manager access required');
    return directReports;
  }

  async getRunPayslips(payrollRunId: string, tenantId: string) {
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items', 'items.employee'],
    });
    if (!run) throw new BadRequestException('Payroll run not found');
    return (run.items ?? [])
      .filter((i) => i.status === PayrollItemStatus.PAID)
      .map((i) => {
        const name = i.employee
          ? `${i.employee.firstName ?? ''} ${i.employee.lastName ?? ''}`.trim()
          : i.memberId;
        return {
          itemId: i.id,
          runId: payrollRunId,
          memberId: i.memberId,
          employeeName: name || 'Unknown',
          published: Boolean(i.metadata?.payslipPublished),
          paidAt: i.paidAt,
        };
      });
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
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items', 'items.employee'],
    });
    if (!run) throw new BadRequestException('Payroll run not found');

    let allowedMemberIds: string[] | undefined;
    if (requesterMemberId && requesterRole && !this.isPayrollAdmin(requesterRole)) {
      const directReports = await this.assertManagerOrAdmin(
        tenantId,
        requesterMemberId,
        requesterRole,
      );
      allowedMemberIds = directReports;
      if (itemIds?.length) {
        const invalid = (run.items ?? []).filter(
          (i) => itemIds.includes(i.id) && !directReports.includes(i.memberId),
        );
        if (invalid.length > 0)
          throw new ForbiddenException('You can only publish payslips for your direct reports');
      }
    }

    const shouldSend = sendEmail ?? (await this.resolveEmailPayslipOnPublish(tenantId));
    const items = (run.items ?? []).filter((i) => {
      if (i.status !== PayrollItemStatus.PAID) return false;
      if (itemIds?.length && !itemIds.includes(i.id)) return false;
      if (allowedMemberIds && !allowedMemberIds.includes(i.memberId)) return false;
      return true;
    });

    const publishedIds: string[] = [];
    for (const item of items) {
      item.metadata = {
        ...item.metadata,
        payslipPublished: true,
        payslipPublishedAt: new Date().toISOString(),
      };
      await this.payrollItemRepository.save(item);
      publishedIds.push(item.id);
    }

    if (publishedIds.length > 0) {
      await this.auditService.logPayslipsPublished(auditContext, {
        itemIds: publishedIds,
        documentIds: [],
        sendEmail: shouldSend,
        publishedCount: publishedIds.length,
      });
    }
    return { publishedCount: publishedIds.length, itemIds: publishedIds };
  }

  async notifyEmployeePaymentSetup(
    payrollRunId: string,
    itemId: string,
    tenantId: string,
    requesterMemberId?: string,
    requesterRole?: string,
  ): Promise<{ notified: boolean }> {
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items', 'items.employee'],
    });
    if (!run) throw new BadRequestException('Payroll run not found');
    const item = run.items?.find((e) => e.id === itemId);
    if (!item?.employee?.userId)
      throw new BadRequestException('Employee not found for notification');
    if (requesterMemberId && requesterRole) {
      await this.assertManagerOrAdmin(tenantId, requesterMemberId, requesterRole);
    }
    return { notified: true };
  }

  private async resolveEmailPayslipOnPublish(_tenantId: string): Promise<boolean> {
    return false;
  }
}
