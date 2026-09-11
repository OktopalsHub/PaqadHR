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
  collectAdjustmentsForEmployee,
  computePayrollItemAmounts,
} from '../utils/payroll-adjustment.util';
import {
  assertPayrollRunDeletable,
  assertPayrollRunMutable,
  assertPayrollRunReopenable,
  assertPayrollRunTitleEditable,
} from '../utils/payroll-mutability.util';
import { AuditService } from './audit.service';
import { resolvePostApprovalPayrollStatus } from './payout-reconciliation';

@Injectable()
export class RunLifecycle {
  constructor(
    private readonly payrollRunRepository: PayrollRunRepository,
    private readonly payrollItemRepository: PayrollItemRepository,
    private readonly auditService: AuditService,
    private readonly managerAccessService: ManagerAccessService,
  ) {}
  isPayrollAdmin(role: string): boolean {
    return role === TenantMemberRole.ADMIN || role === TenantMemberRole.OWNER;
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
    const run = await this.payrollRunRepository.findOne({
      where: { id, tenantId },
      relations: ['items', 'items.employee', 'createdBy', 'tenant'],
    });
    if (!run) return null;
    return this.healMisclassifiedApprovedRun(run);
  }

  async getPayrollRuns(tenantId: string, limit = 20, offset = 0) {
    const { data: runs, total } = await this.payrollRunRepository.paginate({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
      relations: ['createdBy', 'tenant'],
    });
    const healed = await Promise.all(runs.map((run) => this.healMisclassifiedApprovedRun(run)));
    return { runs: healed, total };
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
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items'],
    });
    if (!run) throw new BadRequestException('Payroll run not found');

    const structuralChange =
      dto.frequency !== undefined ||
      dto.periodStart !== undefined ||
      dto.periodEnd !== undefined ||
      dto.paymentDate !== undefined ||
      dto.employeeIds !== undefined;

    if (structuralChange) {
      assertPayrollRunMutable(run, 'edit');
    } else if (dto.title !== undefined) {
      assertPayrollRunTitleEditable(run);
    } else {
      throw new BadRequestException('No payroll run fields to update');
    }

    if (dto.title !== undefined) {
      run.title = dto.title.trim();
    }
    if (dto.frequency !== undefined) {
      run.frequency = dto.frequency;
    }
    if (dto.periodStart !== undefined) {
      run.periodStart = dto.periodStart;
    }
    if (dto.periodEnd !== undefined) {
      run.periodEnd = dto.periodEnd;
    }
    if (dto.paymentDate !== undefined) {
      run.paymentDate = dto.paymentDate;
    }

    if (dto.employeeIds !== undefined) {
      const desired = new Set(dto.employeeIds);
      const currency = run.baseCurrency;
      const activeItems = (run.items ?? []).filter(
        (item) => item.status !== PayrollItemStatus.CANCELLED,
      );

      for (const item of activeItems) {
        if (!desired.has(item.memberId)) {
          item.status = PayrollItemStatus.CANCELLED;
          item.failureReason = 'Excluded from payroll run by administrator';
          item.metadata = { ...item.metadata, excludedFromRun: true };
          await this.payrollItemRepository.save(item);
        }
      }

      const activeMemberIds = new Set(
        (run.items ?? [])
          .filter((item) => item.status !== PayrollItemStatus.CANCELLED)
          .map((item) => item.memberId),
      );

      for (const memberId of desired) {
        if (activeMemberIds.has(memberId)) continue;
        const item = this.payrollItemRepository.create({
          payrollRunId: run.id,
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

      run.employeeCount = desired.size;
    }

    await this.payrollRunRepository.save(run);
    await this.auditService.logAdjustmentCalculated(auditContext, {
      action: structuralChange ? 'update_run' : 'update_run_title',
      payrollRunId,
      title: run.title,
      employeeCount: run.employeeCount,
    });
    return (await this.getPayrollRun(payrollRunId, tenantId))!;
  }
  async deletePayrollRun(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
  ): Promise<void> {
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items'],
    });
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
      const base = Number(item.baseSalary);
      if (base > 0) {
        const lines = collectAdjustmentsForEmployee(
          item.memberId,
          undefined,
          item.metadata ?? undefined,
        );
        const amounts = computePayrollItemAmounts(base, lines);
        item.grossAmount = amounts.grossAmount;
        item.adjustments = amounts.adjustments;
        item.deductions = amounts.deductions;
        item.netAmount = amounts.netAmount;
        item.paymentAmount = amounts.paymentAmount;
      }
      await this.payrollItemRepository.save(item);
      const active = (run.items ?? []).filter((e) => e.status !== PayrollItemStatus.CANCELLED);
      run.totalGrossAmount = active.reduce((s, e) => s + Number(e.grossAmount ?? 0), 0);
      run.totalDeductions = active.reduce((s, e) => s + Number(e.deductions ?? 0), 0);
      run.totalNetAmount = active.reduce((s, e) => s + Number(e.netAmount ?? 0), 0);
      await this.payrollRunRepository.save(run);
    }
    await this.auditService.logAdjustmentCalculated(auditContext, {
      action: 'update_item',
      itemId,
      memberId: item.memberId,
      adjustmentCount: dto.adjustmentLines?.length ?? 0,
    });
    return (await this.getPayrollRun(payrollRunId, tenantId))!;
  }

  /**
   * Older payout reconciliation set approved runs back to `processing`, which resurfaces Approve.
   * Heal on read using approvedAt + item statuses.
   */
  private async healMisclassifiedApprovedRun(run: PayrollRun): Promise<PayrollRun> {
    const approvedAt = run.metadata?.approvedAt;
    if (
      run.status !== PayrollStatus.PROCESSING ||
      typeof approvedAt !== 'string' ||
      approvedAt.length === 0
    ) {
      return run;
    }

    const items = run.items;
    if (!items || items.length === 0) {
      run.status = PayrollStatus.APPROVED;
      return this.payrollRunRepository.save(run);
    }

    let pending = 0;
    let processing = 0;
    let paid = 0;
    let failed = 0;
    let cancelled = 0;
    for (const item of items) {
      switch (item.status) {
        case PayrollItemStatus.PENDING:
          pending += 1;
          break;
        case PayrollItemStatus.PROCESSING:
          processing += 1;
          break;
        case PayrollItemStatus.PAID:
          paid += 1;
          break;
        case PayrollItemStatus.FAILED:
          failed += 1;
          break;
        case PayrollItemStatus.CANCELLED:
          cancelled += 1;
          break;
        default:
          break;
      }
    }

    const next = resolvePostApprovalPayrollStatus({
      pending,
      processing,
      paid,
      failed,
      active: items.length - cancelled,
    });
    if (next === run.status) return run;
    run.status = next;
    if (next === PayrollStatus.COMPLETED) {
      run.processedAt = run.processedAt ?? new Date();
    }
    return this.payrollRunRepository.save(run);
  }
}
