import { BadRequestException } from '@nestjs/common';

import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { PayrollStatus } from '../../../../common/enums/payroll-status.enum';
import { AuditContext } from '../../../../common/interfaces/audit-context.interface';
import { UpdatePayrollItemDto } from '../dto/update-payroll-item.dto';
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
} from '../utils/payroll-mutability.util';
import { AuditService } from './audit.service';
import { RunQueryOps } from './run-query.ops';

export class RunItemOps {
  constructor(
    private readonly payrollRunRepository: PayrollRunRepository,
    private readonly payrollItemRepository: PayrollItemRepository,
    private readonly auditService: AuditService,
    private readonly query: RunQueryOps,
  ) {}

  async deletePayrollRun(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
  ): Promise<void> {
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: { items: true },
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
      relations: { items: true },
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
    return (await this.query.getPayrollRun(payrollRunId, tenantId))!;
  }

  async removePayrollItem(
    payrollRunId: string,
    itemId: string,
    tenantId: string,
    auditContext: AuditContext,
  ): Promise<PayrollRun> {
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: { items: true },
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
      relations: { items: true },
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
    return (await this.query.getPayrollRun(payrollRunId, tenantId))!;
  }
}
