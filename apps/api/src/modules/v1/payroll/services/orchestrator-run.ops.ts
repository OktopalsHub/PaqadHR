import { BadRequestException, Logger, Optional } from '@nestjs/common';

import { PayrollStatus } from '../../../../common/enums/payroll-status.enum';
import { AuditContext } from '../../../../common/interfaces/audit-context.interface';
import { BatchPaymentResult } from '../../../../common/interfaces/batch-payment-result.interface';
import { ProcessPayrollWithAudit } from '../../../../common/interfaces/process-payroll-dto.interface';
import {
  payrollCalendarDatePart,
  payrollTodayCalendarDatePart,
} from '../../../../common/validators/payroll-date.validator';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { AuditService } from './audit.service';
import { ManualDisbursementService } from './manual-disbursement.service';
import { MultiPaymentService } from './multi-payment.service';
import { OrchestratorReadinessOps } from './orchestrator-readiness.ops';
import { PayrollExportService } from './payroll-export.service';
import { PayrollLifecycleNotifyService } from './payroll-lifecycle-notify.service';

export class OrchestratorRunOps {
  private readonly logger = new Logger('PayrollPaymentOrchestrator');

  constructor(
    private readonly payrollRunRepository: PayrollRunRepository,
    private readonly auditService: AuditService,
    private readonly manualDisbursementService: ManualDisbursementService,
    private readonly multiPaymentService: MultiPaymentService,
    private readonly payrollExportService: PayrollExportService,
    private readonly readiness: OrchestratorReadinessOps,
    @Optional() private readonly lifecycleNotify?: PayrollLifecycleNotifyService,
  ) {}

  async processPayroll(dto: ProcessPayrollWithAudit): Promise<void> {
    const run = await this.payrollRunRepository.findOne({
      where: { id: dto.payrollRunId, tenantId: dto.tenantId },
    });
    if (!run) throw new BadRequestException('Payroll run not found');
    if (run.status === PayrollStatus.COMPLETED) throw new BadRequestException('Already completed');
    if (run.status === PayrollStatus.FAILED)
      throw new BadRequestException('Cannot process a failed run');
    if (run.status === PayrollStatus.APPROVED && run.payoutMode === 'scheduled') {
      throw new BadRequestException(
        'Scheduled payroll must be processed by its payment date or paid explicitly now.',
      );
    }
    const start = Date.now();
    await this.multiPaymentService.processMultiPaymentPayroll(
      dto.payrollRunId,
      dto.tenantId,
      dto.auditContext,
    );
    const refreshed = await this.payrollRunRepository.findOne({
      where: { id: dto.payrollRunId, tenantId: dto.tenantId },
    });
    if (refreshed) {
      await this.auditService.logPayrollProcessed(
        dto.auditContext,
        {
          title: refreshed.title,
          totalGrossAmount: refreshed.totalGrossAmount,
          totalNetAmount: refreshed.totalNetAmount,
          employeeCount: refreshed.employeeCount,
        },
        { processingDuration: Date.now() - start },
      );
    }
  }

  async payNowPayroll(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
  ): Promise<BatchPaymentResult> {
    const run = await this.payrollRunRepository.findOne({ where: { id: payrollRunId, tenantId } });
    if (!run) throw new BadRequestException('Payroll run not found');
    if (run.status !== PayrollStatus.APPROVED) {
      throw new BadRequestException(`Must be APPROVED. Current: ${run.status}`);
    }
    run.payoutMode = 'immediate';
    await this.payrollRunRepository.save(run);
    return this.multiPaymentService.processMultiPaymentPayroll(
      payrollRunId,
      tenantId,
      auditContext,
    );
  }

  async schedulePayrollPayout(
    payrollRunId: string,
    tenantId: string,
    paymentDate?: Date,
    auditContext?: AuditContext,
  ): Promise<PayrollRun> {
    const run = await this.payrollRunRepository.findOne({ where: { id: payrollRunId, tenantId } });
    if (!run) throw new BadRequestException('Payroll run not found');
    if (run.status !== PayrollStatus.APPROVED) {
      throw new BadRequestException(`Must be APPROVED. Current: ${run.status}`);
    }
    if (paymentDate) run.paymentDate = paymentDate;
    if (!run.paymentDate) throw new BadRequestException('Set a payment date before scheduling');
    if (payrollCalendarDatePart(run.paymentDate) <= payrollTodayCalendarDatePart()) {
      throw new BadRequestException('Payment date must be in the future');
    }
    run.payoutMode = 'scheduled';
    const scheduledFor = this.readiness.toIsoDatePart(run.paymentDate);
    run.metadata = {
      ...run.metadata,
      scheduledAt: new Date().toISOString(),
      scheduledFor,
    };
    const saved = await this.payrollRunRepository.save(run);
    if (this.lifecycleNotify && auditContext) {
      await this.lifecycleNotify.onPayrollScheduled({
        tenantId,
        run: {
          id: saved.id,
          title: saved.title,
          tenantId,
          periodStart: saved.periodStart,
          periodEnd: saved.periodEnd,
          baseCurrency: saved.baseCurrency,
          paymentDate: saved.paymentDate,
        },
        paymentDate: scheduledFor,
        auditContext,
      });
    }
    return saved;
  }

  async rollbackScheduledPayroll(payrollRunId: string, tenantId: string): Promise<void> {
    const run = await this.payrollRunRepository.findOne({ where: { id: payrollRunId, tenantId } });
    if (run?.payoutMode !== 'scheduled') return;

    const metadata = { ...run.metadata };
    delete metadata.scheduledAt;
    delete metadata.scheduledFor;
    run.metadata = metadata;
    run.payoutMode = 'immediate';
    await this.payrollRunRepository.save(run);
  }

  async processDueScheduledPayouts(): Promise<{ processed: number; failed: number }> {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const dueRuns = await this.payrollRunRepository
      .createQueryBuilder('run')
      .where('run.status = :status', { status: PayrollStatus.APPROVED })
      .andWhere('run.payout_mode = :mode', { mode: 'scheduled' })
      .andWhere('run.payment_date <= :today', { today: today.toISOString().slice(0, 10) })
      .getMany();

    let processed = 0,
      failed = 0;
    for (const run of dueRuns) {
      try {
        await this.multiPaymentService.processMultiPaymentPayroll(run.id, run.tenantId, {
          tenantId: run.tenantId,
          payrollRunId: run.id,
          performedById: run.createdById,
        });
        processed++;
      } catch (error) {
        failed++;
        this.logger.error(
          `Scheduled payout failed for ${run.id}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
    return { processed, failed };
  }

  async disburseManualPayroll(
    dto: ProcessPayrollWithAudit & { confirmed: boolean },
  ): Promise<{ paidCount: number; failedCount: number }> {
    const run = await this.payrollRunRepository.findOne({
      where: { id: dto.payrollRunId, tenantId: dto.tenantId },
      relations: { items: { employee: true } },
    });
    if (!run) throw new BadRequestException('Payroll run not found');
    return this.manualDisbursementService.disbursePayrollRun(run, dto.auditContext, dto.confirmed);
  }

  async exportBankFile(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
  ): Promise<string> {
    const run = await this.payrollExportService.getPayrollRunForExport(payrollRunId, tenantId);
    if (
      run.status !== PayrollStatus.PROCESSING &&
      run.status !== PayrollStatus.APPROVED &&
      run.status !== PayrollStatus.COMPLETED
    ) {
      throw new BadRequestException('Export requires a calculated payroll run');
    }
    const rows = await this.payrollExportService.buildBankExportRows(run);
    const csv = this.payrollExportService.toCsv(rows, run);
    await this.auditService.logPayrollExported(auditContext, {
      exportType: 'bank_csv',
      rowCount: rows.length,
      payrollRunId,
    });
    return csv;
  }
}
