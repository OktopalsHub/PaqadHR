import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { TenantMemberRole } from '../../../../common/enums';
import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { PayrollStatus } from '../../../../common/enums/payroll-status.enum';
import type { AuditContext } from '../../../../common/interfaces/audit-context.interface';
import { ManagerAccessService } from '../../../../common/services/manager-access.service';
import type { CreatePayrollRunDto } from '../dto/create-payroll-run.dto';
import type { PatchPayrollRunDto } from '../dto/patch-payroll-run.dto';
import type { UpdatePayrollItemDto } from '../dto/update-payroll-item.dto';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import {
  assertPayrollRunDeletable,
  assertPayrollRunMutable,
  assertPayrollRunReopenable,
  assertPayrollRunTitleEditable,
} from '../utils/payroll-mutability.util';
import { AuditService } from './audit.service';

@Injectable()
export class PayrollRunService {
  constructor(
    private readonly payrollRunRepository: PayrollRunRepository,
    private readonly payrollItemRepository: PayrollItemRepository,
    private readonly auditService: AuditService,
    private readonly managerAccessService: ManagerAccessService,
  ) {}

  isPayrollAdmin(role: string): boolean {
    return role === TenantMemberRole.ADMIN || role === TenantMemberRole.OWNER;
  }

  async assertPayrollMemberAccess(
    tenantId: string,
    targetMemberId: string,
    requesterMemberId: string,
    requesterRole: string,
  ): Promise<void> {
    if (this.isPayrollAdmin(requesterRole) || targetMemberId === requesterMemberId) return;
    const isManager = await this.managerAccessService.isManagerOf(
      tenantId,
      requesterMemberId,
      targetMemberId,
    );
    if (!isManager)
      throw new ForbiddenException(
        'You can only access payroll for yourself or your direct reports',
      );
  }

  async createPayrollRun(
    dto: CreatePayrollRunDto,
    tenantId: string,
    createdById: string,
    idempotencyKey?: string,
  ): Promise<PayrollRun & { alreadyExists?: boolean }> {
    const currency = dto.baseCurrency.trim().toUpperCase();
    const key =
      idempotencyKey ||
      `${tenantId}-${dto.periodStart.toISOString()}-${dto.periodEnd.toISOString()}-${currency}`;

    const existing = await this.payrollRunRepository.findOne({
      where: { idempotencyKey: key, tenantId },
    });
    if (existing) return Object.assign(existing, { alreadyExists: true });

    const dup = await this.payrollRunRepository.findOne({
      where: {
        tenantId,
        periodStart: dto.periodStart,
        periodEnd: dto.periodEnd,
        baseCurrency: currency,
      },
    });
    if (dup) return Object.assign(dup, { alreadyExists: true });

    const run = this.payrollRunRepository.create({
      title: dto.title,
      frequency: dto.frequency,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      paymentDate: dto.paymentDate,
      baseCurrency: currency,
      status: PayrollStatus.DRAFT,
      employeeCount: dto.employeeIds.length,
      createdById,
      tenantId,
      idempotencyKey: key,
      payoutMode: null,
    });
    const saved = await this.payrollRunRepository.save(run);

    for (const memberId of dto.employeeIds) {
      const item = this.payrollItemRepository.create({
        payrollRunId: saved.id,
        memberId,
        status: PayrollItemStatus.PENDING,
        baseSalary: 0,
        baseSalaryCurrency: currency,
        grossAmount: 0,
        netAmount: 0,
        paymentCurrency: currency,
        paymentAmount: 0,
        exchangeRate: 1,
      });
      await this.payrollItemRepository.save(item);
    }

    await this.auditService.logPayrollCreated(
      { tenantId, payrollRunId: saved.id, performedById: createdById },
      {
        title: dto.title,
        frequency: dto.frequency,
        employeeCount: dto.employeeIds.length,
        baseCurrency: currency,
      },
    );
    return saved;
  }

  async getPayrollRun(id: string, tenantId: string): Promise<PayrollRun | null> {
    return this.payrollRunRepository.findOne({
      where: { id, tenantId },
      relations: ['items', 'items.employee', 'createdBy', 'tenant'],
    });
  }

  async getPayrollRuns(tenantId: string, limit = 20, offset = 0) {
    const { data: runs, total } = await this.payrollRunRepository.paginate({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
      relations: ['createdBy', 'tenant'],
    });
    return { runs, total };
  }

  async getPayrollRunsForRequester(
    tenantId: string,
    limit: number,
    offset: number,
    requesterMemberId: string,
    requesterRole: string,
  ) {
    if (this.isPayrollAdmin(requesterRole)) return this.getPayrollRuns(tenantId, limit, offset);

    const directReports = await this.managerAccessService.getDirectReportIds(
      tenantId,
      requesterMemberId,
    );
    if (directReports.length === 0)
      throw new ForbiddenException('Admin or manager access required');

    const items = await this.payrollItemRepository.find({
      where: { memberId: In(directReports) },
      select: ['payrollRunId'],
    });
    const runIds = [...new Set(items.map((i) => i.payrollRunId))];
    if (runIds.length === 0) return { runs: [], total: 0 };

    return this.payrollRunRepository.paginate({
      where: { tenantId, id: In(runIds) },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
      relations: ['createdBy', 'tenant'],
    });
  }

  async getPayrollRunForRequester(
    id: string,
    tenantId: string,
    requesterMemberId: string,
    requesterRole: string,
  ): Promise<PayrollRun | null> {
    const run = await this.getPayrollRun(id, tenantId);
    if (!run) return null;
    if (this.isPayrollAdmin(requesterRole)) return run;

    const directReports = await this.managerAccessService.getDirectReportIds(
      tenantId,
      requesterMemberId,
    );
    if (directReports.length === 0)
      throw new ForbiddenException('Admin or manager access required');
    const teamItems = (run.items ?? []).filter((i) => directReports.includes(i.memberId));
    if (teamItems.length === 0) throw new ForbiddenException('No access to this payroll run');
    run.items = teamItems;
    return run;
  }

  async updatePayrollRun(
    payrollRunId: string,
    tenantId: string,
    dto: PatchPayrollRunDto,
    auditContext: AuditContext,
  ): Promise<PayrollRun> {
    const run = await this.payrollRunRepository.findOne({ where: { id: payrollRunId, tenantId } });
    if (!run) throw new BadRequestException('Payroll run not found');
    assertPayrollRunTitleEditable(run);
    run.title = dto.title.trim();
    await this.payrollRunRepository.save(run);
    await this.auditService.logAdjustmentCalculated(auditContext, {
      action: 'update_run_title',
      payrollRunId,
      previousTitle: run.title,
      title: run.title,
    });
    return (await this.getPayrollRun(payrollRunId, tenantId))!;
  }

  async deletePayrollRun(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
  ): Promise<void> {
    const run = await this.payrollRunRepository.findOne({ where: { id: payrollRunId, tenantId } });
    if (!run) throw new BadRequestException('Payroll run not found');
    assertPayrollRunDeletable(run);
    await this.payrollRunRepository.delete(payrollRunId);
    await this.auditService.logAdjustmentCalculated(auditContext, {
      action: 'delete_run',
      payrollRunId,
      title: run.title,
    });
  }

  async reopenPayrollRun(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
  ): Promise<PayrollRun> {
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items'],
    });
    if (!run) throw new BadRequestException('Payroll run not found');
    assertPayrollRunReopenable(run);
    run.status = PayrollStatus.DRAFT;
    run.metadata = {
      ...run.metadata,
      reopenedAt: new Date().toISOString(),
      reopenedBy: auditContext.performedById,
    };
    await this.payrollRunRepository.save(run);

    for (const item of run.items ?? []) {
      if (item.metadata?.lockedAt) {
        const { lockedAt: _, ...rest } = item.metadata;
        item.metadata = rest;
        await this.payrollItemRepository.save(item);
      }
    }
    await this.auditService.logAdjustmentCalculated(auditContext, {
      action: 'reopen_run',
      payrollRunId,
      title: run.title,
    });
    return (await this.getPayrollRun(payrollRunId, tenantId))!;
  }

  async removePayrollItem(
    payrollRunId: string,
    itemId: string,
    tenantId: string,
    auditContext: AuditContext,
  ): Promise<PayrollRun> {
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items'],
    });
    if (!run) throw new BadRequestException('Payroll run not found');
    assertPayrollRunMutable(run, 'remove');
    const item = run.items?.find((e) => e.id === itemId);
    if (!item) throw new BadRequestException('Payroll item not found');

    item.status = PayrollItemStatus.CANCELLED;
    item.failureReason = 'Excluded from payroll run by administrator';
    item.metadata = { ...item.metadata, excludedFromRun: true };
    await this.payrollItemRepository.save(item);

    const active = (run.items ?? []).filter(
      (e) => e.id !== itemId && e.status !== PayrollItemStatus.CANCELLED,
    );
    run.employeeCount = active.length;
    run.totalGrossAmount = active.reduce((s, e) => s + Number(e.grossAmount ?? 0), 0);
    run.totalDeductions = active.reduce((s, e) => s + Number(e.deductions ?? 0), 0);
    run.totalNetAmount = active.reduce((s, e) => s + Number(e.netAmount ?? 0), 0);
    await this.payrollRunRepository.save(run);

    await this.auditService.logAdjustmentCalculated(auditContext, {
      action: 'remove_employee',
      itemId,
      memberId: item.memberId,
    });
    return run;
  }

  async updatePayrollItem(
    payrollRunId: string,
    itemId: string,
    tenantId: string,
    dto: UpdatePayrollItemDto,
    auditContext: AuditContext,
  ): Promise<PayrollRun> {
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items'],
    });
    if (!run) throw new BadRequestException('Payroll run not found');
    assertPayrollRunMutable(run, 'edit');
    const item = run.items?.find((e) => e.id === itemId);
    if (!item) throw new BadRequestException('Payroll item not found');
    if (item.status === PayrollItemStatus.CANCELLED)
      throw new BadRequestException('Cannot edit cancelled item');

    if (dto.adjustmentLines !== undefined) {
      item.metadata = { ...item.metadata, adjustmentLines: dto.adjustmentLines };
      await this.payrollItemRepository.save(item);
    }
    await this.auditService.logAdjustmentCalculated(auditContext, {
      action: 'update_item',
      itemId,
      memberId: item.memberId,
      adjustmentCount: dto.adjustmentLines?.length ?? 0,
    });
    return (await this.getPayrollRun(payrollRunId, tenantId))!;
  }

  async getRunPayslips(payrollRunId: string, tenantId: string) {
    const run = await this.getPayrollRun(payrollRunId, tenantId);
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
    const run = await this.getPayrollRun(payrollRunId, tenantId);
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
      await this.assertPayrollMemberAccess(
        tenantId,
        item.memberId,
        requesterMemberId,
        requesterRole,
      );
    }
    return { notified: true };
  }

  private async assertManagerOrAdmin(
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

  private async resolveEmailPayslipOnPublish(_tenantId: string): Promise<boolean> {
    return false;
  }
}
