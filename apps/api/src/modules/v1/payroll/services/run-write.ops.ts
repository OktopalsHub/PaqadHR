import { BadRequestException } from '@nestjs/common';

import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { PayrollStatus } from '../../../../common/enums/payroll-status.enum';
import { AuditContext } from '../../../../common/interfaces/audit-context.interface';
import { payrollTodayCalendarDatePart } from '../../../../common/validators/payroll-date.validator';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { CreatePayrollRunDto } from '../dto/create-payroll-run.dto';
import { PatchPayrollRunDto } from '../dto/patch-payroll-run.dto';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import {
  assertPayrollRunMutable,
  assertPayrollRunTitleEditable,
} from '../utils/payroll-mutability.util';
import { AuditService } from './audit.service';
import { RunQueryOps } from './run-query.ops';

export class RunWriteOps {
  constructor(
    private readonly payrollRunRepository: PayrollRunRepository,
    private readonly payrollItemRepository: PayrollItemRepository,
    private readonly auditService: AuditService,
    private readonly query: RunQueryOps,
  ) {}

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
    const payoutMode = dto.payoutMode ?? 'immediate';
    const tenant = await this.payrollRunRepository.manager.getRepository(Tenant).findOne({
      where: { id: tenantId },
      select: { id: true, timezone: true },
    });
    if (!tenant) throw new BadRequestException('Tenant not found');
    const today = payrollTodayCalendarDatePart(tenant.timezone);
    if (payoutMode === 'scheduled' && !dto.paymentDate) {
      throw new BadRequestException('Payment date is required for scheduled payroll');
    }
    const paymentDate =
      payoutMode === 'immediate' ? new Date(`${today}T00:00:00.000Z`) : dto.paymentDate!;
    const run = this.payrollRunRepository.create({
      title: dto.title,
      frequency: dto.frequency,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      paymentDate,
      baseCurrency: currency,
      status: PayrollStatus.DRAFT,
      employeeCount: dto.employeeIds.length,
      createdById,
      tenantId,
      idempotencyKey: key,
      payoutMode,
    });
    const saved = await this.payrollRunRepository.save(run);
    const items = dto.employeeIds.map((memberId) =>
      this.payrollItemRepository.create({
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
      }),
    );
    await this.payrollItemRepository.save(items);
    await this.auditService.logPayrollCreated(
      { tenantId, payrollRunId: saved.id, performedById: createdById },
      {
        title: dto.title,
        frequency: dto.frequency,
        employeeCount: dto.employeeIds.length,
        baseCurrency: currency,
        payoutMode: saved.payoutMode,
      },
    );
    return saved;
  }

  async updatePayrollRun(
    payrollRunId: string,
    tenantId: string,
    dto: PatchPayrollRunDto,
    auditContext: AuditContext,
  ): Promise<PayrollRun> {
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: { items: true },
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
    return (await this.query.getPayrollRun(payrollRunId, tenantId))!;
  }
}
