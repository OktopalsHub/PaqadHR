import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { PayrollStatus } from '../../../../common/enums/payroll-status.enum';
import type { AuditContext } from '../../../../common/interfaces/audit-context.interface';
import type { PayrollPaymentReadiness } from '../../../../common/interfaces/payroll-payment-readiness.interface';
import type { ProcessPayrollWithAudit } from '../../../../common/interfaces/process-payroll-dto.interface';
import { PaymentMethodService } from '../../payment-method/services/payment-method.service';
import { isPayrollGatewayEnabled } from '../config/payroll-disbursement.config';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { isActivePayrollReadinessItem } from '../utils/payroll-readiness-items.util';
import { AuditService } from './audit.service';
import { ManualDisbursementService } from './manual-disbursement.service';
import { MultiPaymentService } from './multi-payment.service';
import { PayrollExportService } from './payroll-export.service';
import { PayrollLifecycleNotifyService } from './payroll-lifecycle-notify.service';

@Injectable()
export class PayrollPaymentOrchestrator {
  private readonly logger = new Logger(PayrollPaymentOrchestrator.name);

  constructor(
    private readonly payrollRunRepository: PayrollRunRepository,
    private readonly payrollItemRepository: PayrollItemRepository,
    private readonly paymentMethodService: PaymentMethodService,
    readonly _dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly manualDisbursementService: ManualDisbursementService,
    private readonly multiPaymentService: MultiPaymentService,
    private readonly payrollExportService: PayrollExportService,
    @Optional() private readonly lifecycleNotify?: PayrollLifecycleNotifyService,
  ) {}

  async getPayrollReadiness(payrollRunId: string, tenantId: string) {
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items', 'items.employee'],
    });
    if (!run) throw new BadRequestException('Payroll run not found');

    const items: Array<
      PayrollPaymentReadiness & {
        itemId: string;
        employeeName: string;
        netAmount: number;
        status: PayrollItemStatus;
      }
    > = [];

    const activeItems = (run.items ?? []).filter((item) => isActivePayrollReadinessItem(item));

    for (const item of activeItems) {
      const name = item.employee
        ? `${item.employee.firstName ?? ''} ${item.employee.lastName ?? ''}`.trim()
        : item.memberId;
      const readiness = await this.paymentMethodService.assessPayrollReadiness(
        tenantId,
        item.memberId,
        run.baseCurrency,
        false,
      );
      items.push({
        ...readiness,
        itemId: item.id,
        employeeName: name || 'Unknown',
        netAmount: Number(item.netAmount ?? 0),
        status: item.status,
      });
    }

    const readyCount = items.filter((i) => i.ready).length;
    return {
      payrollRunId,
      currency: run.baseCurrency,
      totalEmployees: items.length,
      readyCount,
      notReadyCount: items.length - readyCount,
      canApprove: items.length > 0 && readyCount === items.length,
      items,
    };
  }

  async approvePayroll(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
  ): Promise<PayrollRun> {
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items'],
    });
    if (!run) throw new BadRequestException('Payroll run not found');
    if (run.status !== PayrollStatus.PROCESSING) {
      throw new BadRequestException(`Must be PROCESSING to approve. Current: ${run.status}`);
    }

    const readiness = await this.getPayrollReadiness(payrollRunId, tenantId);
    const notReady = readiness.items.filter((i) => !i.ready);
    if (notReady.length > 0) {
      throw new BadRequestException(
        `${notReady.length} employee(s) not ready. Remove them or notify to complete payment settings.`,
      );
    }

    run.status = PayrollStatus.APPROVED;
    run.metadata = {
      ...run.metadata,
      approvedAt: new Date().toISOString(),
      approvedBy: auditContext.performedById,
    };
    if (run.payoutMode === 'scheduled') {
      run.metadata.scheduledAt = new Date().toISOString();
      run.metadata.scheduledFor = this.toIsoDatePart(run.paymentDate);
    }
    for (const item of run.items ?? []) {
      if (item.status === PayrollItemStatus.CANCELLED) continue;
      item.metadata = { ...item.metadata, lockedAt: new Date().toISOString() };
      await this.payrollItemRepository.save(item);
    }
    await this.payrollRunRepository.save(run);
    await this.auditService.logPayrollApproved(auditContext, {
      title: run.title,
      totalNetAmount: run.totalNetAmount,
      employeeCount: run.employeeCount,
    });
    if (this.lifecycleNotify) {
      await this.lifecycleNotify.onPayrollApproved({
        tenantId,
        run: {
          id: run.id,
          title: run.title,
          tenantId,
          periodStart: run.periodStart,
          periodEnd: run.periodEnd,
          baseCurrency: run.baseCurrency,
        },
        actorMemberId: auditContext.performedById,
      });
      if (run.payoutMode === 'scheduled') {
        await this.lifecycleNotify.onPayrollScheduled({
          tenantId,
          run: {
            id: run.id,
            title: run.title,
            tenantId,
            periodStart: run.periodStart,
            periodEnd: run.periodEnd,
            baseCurrency: run.baseCurrency,
            paymentDate: run.paymentDate,
          },
          paymentDate: this.toIsoDatePart(run.paymentDate),
          auditContext,
        });
      }
    }
    return run;
  }

  async processPayroll(dto: ProcessPayrollWithAudit): Promise<void> {
    if (!isPayrollGatewayEnabled()) {
      throw new BadRequestException(
        'Payroll gateway not configured. Use manual disburse or configure providers.',
      );
    }
    const run = await this.payrollRunRepository.findOne({
      where: { id: dto.payrollRunId, tenantId: dto.tenantId },
    });
    if (!run) throw new BadRequestException('Payroll run not found');
    if (run.status === PayrollStatus.COMPLETED) throw new BadRequestException('Already completed');
    if (run.status === PayrollStatus.FAILED)
      throw new BadRequestException('Cannot process a failed run');
    if (run.status === PayrollStatus.APPROVED) {
      run.payoutMode = 'immediate';
      await this.payrollRunRepository.save(run);
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
  ): Promise<unknown> {
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
    run.payoutMode = 'scheduled';
    const scheduledFor = this.toIsoDatePart(run.paymentDate);
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

  async processDueScheduledPayouts(): Promise<{ processed: number; failed: number }> {
    if (!isPayrollGatewayEnabled()) return { processed: 0, failed: 0 };
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
        if (this.lifecycleNotify) {
          await this.lifecycleNotify.onScheduledPayoutDue({
            tenantId: run.tenantId,
            run: {
              id: run.id,
              title: run.title,
              tenantId: run.tenantId,
              periodStart: run.periodStart,
              periodEnd: run.periodEnd,
              paymentDate: run.paymentDate,
            },
          });
        }
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
      relations: ['items', 'items.employee'],
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

  private toIsoDatePart(value: Date | string): string {
    return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  }
}
