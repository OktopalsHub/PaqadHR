import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollCalculationService } from './payroll-calculation.service';
import {
  BadRequestException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NombaProvider } from '../../../../common/providers/nomba.provider';
import { isManualPayrollDisbursement } from '../config/payroll-disbursement.config';
import { ManualDisbursementService } from './manual-disbursement.service';
import { PayrollExportService } from './payroll-export.service';
import { EmploymentService } from '../../employment/employment.service';
import { PaymentMethodType } from 'src/common/enums';
import { PaymentMethodService } from '../../payment-method/services/payment-method.service';
import { AuditService } from './audit.service';
import { AuditContext } from '../../../../common/interfaces/audit-context.interface';
import {
  ProcessPayrollWithAudit,
} from '../../../../common/interfaces/process-payroll-dto.interface';

interface PayrollPreviewEmployee {
  employeeId: string;
  adjustments?: PayrollAdjustmentDto[];
}

interface PayrollPreviewDto {
  employees: PayrollPreviewEmployee[];
}

export interface PayrollPreviewResult {
  employeeId: string;
  baseSalary: number;
  currency: string;
  payType: string;
  paySchedule: string;
  finalAmount: number;
  adjustments: PayrollAdjustmentDto[];
}
import { PayrollAdjustmentDto } from "../dto/payroll-adjustment.dto";
import { PayrollRunRepository } from "../repositories/payroll-run.repository";
import { PayrollItemRepository } from "../repositories/payroll-item.repository";
import { CreatePayrollRunDto } from "../dto/create-payroll-run.dto";
import { PAYROLL_SECURITY_CONFIG } from "../config/security.config";
import { PaymentMethod } from "../../payment-method/entities/payment-method.entity";
import { PayrollItemStatus } from "../../../../common/enums/payroll-item-status.enum";
import { PayrollStatus } from "../../../../common/enums/payroll-status.enum";
import { PayrollFrequency } from "../../../../common/enums/payroll-frequency.enum";
import { SimplePayrollInput } from "../../../../common/interfaces/simple-payroll-input.interface";
@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);
  constructor(
    private readonly payrollRunRepository: PayrollRunRepository,
    private readonly payrollItemRepository: PayrollItemRepository,
    private readonly paymentMethodService: PaymentMethodService,
    private readonly dataSource: DataSource,
    private readonly payrollCalculationService: PayrollCalculationService,
    private readonly auditService: AuditService,
    private readonly employmentService: EmploymentService,
    private readonly manualDisbursementService: ManualDisbursementService,
    private readonly payrollExportService: PayrollExportService,
    @Optional() private readonly nombaProvider?: NombaProvider,
  ) {}
  async createPayrollRun(
    dto: CreatePayrollRunDto,
    tenantId: string,
    createdById: string,
    idempotencyKey?: string,
  ): Promise<PayrollRun> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const finalIdempotencyKey =
        idempotencyKey ||
        `${tenantId}-${dto.periodStart.toISOString()}-${dto.periodEnd.toISOString()}`;
      await queryRunner.query(
        `SELECT id FROM tenants WHERE id = $1 FOR UPDATE`,
        [tenantId],
      );
      if (finalIdempotencyKey) {
        const existingByKey = await this.payrollRunRepository.findOne({
          where: { idempotencyKey: finalIdempotencyKey },
        });
        if (existingByKey) {
          await queryRunner.rollbackTransaction();
          this.logger.log(
            `Returning existing payroll run for idempotency key: ${finalIdempotencyKey}`,
          );
          return existingByKey;
        }
      }
      const existingRun = await this.payrollRunRepository.findOne({
        where: {
          tenantId,
          periodStart: dto.periodStart,
          periodEnd: dto.periodEnd,
        },
      });
      if (existingRun) {
        throw new BadRequestException(
          `A payroll run already exists for the period ${dto.periodStart.toISOString().split('T')[0]} to ${dto.periodEnd.toISOString().split('T')[0]}. Use the existing run ID: ${existingRun.id}`,
        );
      }
      const payrollRunData = {
        title: dto.title,
        frequency: dto.frequency as unknown as PayrollFrequency,
        periodStart: dto.periodStart,
        periodEnd: dto.periodEnd,
        paymentDate: dto.paymentDate,
        baseCurrency: dto.baseCurrency,
        status: PayrollStatus.DRAFT,
        employeeCount: dto.employeeIds.length,
        createdById,
        tenantId,
        idempotencyKey: finalIdempotencyKey,
      };
      const savedPayrollRun =
        await this.payrollRunRepository.create(payrollRunData);
      for (const memberId of dto.employeeIds) {
        await this.payrollItemRepository.create({
          payrollRunId: savedPayrollRun.id,
          memberId,
          status: PayrollItemStatus.PENDING,
          baseSalary: 0, 
          baseSalaryCurrency: dto.baseCurrency,
          grossAmount: 0,
          netAmount: 0,
          paymentCurrency: dto.baseCurrency,
          paymentAmount: 0,
          exchangeRate: 1,
        });
      }
      await queryRunner.commitTransaction();
      await this.auditService.logPayrollCreated(
        { payrollRunId: savedPayrollRun.id, performedById: createdById },
        {
          title: dto.title,
          frequency: dto.frequency,
          employeeCount: dto.employeeIds.length,
          baseCurrency: dto.baseCurrency,
        },
      );
      this.logger.log(
        `Created payroll run ${savedPayrollRun.id} with ${dto.employeeIds.length} employees`,
      );
      return savedPayrollRun;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Failed to create payroll run:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
  async calculatePayroll(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
    adjustments?: PayrollAdjustmentDto[],
  ): Promise<void> {
    const payrollRun = await this.acquireProcessingLock(
      payrollRunId,
      tenantId,
      auditContext.performedById || '',
    );
    if (!payrollRun) {
      throw new BadRequestException('Payroll run not found');
    }
    if (payrollRun.status === PayrollStatus.COMPLETED) {
      await this.releaseProcessingLock(payrollRunId);
      throw new BadRequestException(
        'Payroll run has already been completed and cannot be recalculated',
      );
    }
    if (payrollRun.status !== PayrollStatus.DRAFT) {
      await this.releaseProcessingLock(payrollRunId);
      throw new BadRequestException(
        `Payroll run is in ${payrollRun.status} status and cannot be calculated`,
      );
    }
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const employeeIds = payrollRun.items.map((item) => item.memberId);
      const salaryInfoMap =
        await this.employmentService.getBulkEmploymentSalaryInfo(
          employeeIds,
          tenantId,
        );
      const adjustmentsByEmployee = new Map<string, PayrollAdjustmentDto[]>();
      if (adjustments) {
        for (const adjustment of adjustments) {
          if (!adjustmentsByEmployee.has(adjustment.employeeId)) {
            adjustmentsByEmployee.set(adjustment.employeeId, []);
          }
          adjustmentsByEmployee.get(adjustment.employeeId)!.push(adjustment);
        }
      }
      let totalGrossAmount = 0;
      let totalDeductions = 0;
      let totalNetAmount = 0;
      for (const item of payrollRun.items) {
        const paymentMethod = await this.paymentMethodService.findByMemberId(
          item.memberId,
        );
        if (!paymentMethod) {
          throw new BadRequestException(
            `Payment method not found for employee ${item.memberId}`,
          );
        }
        const salaryInfo = salaryInfoMap.get(item.memberId);
        if (!salaryInfo) {
          throw new BadRequestException(
            `No employment record found for employee ${item.memberId}. Please ensure employee has an active employment record with salary information.`,
          );
        }
        const employeeAdjustments =
          adjustmentsByEmployee.get(item.memberId) || [];
        const calculationInput: SimplePayrollInput = {
          memberId: item.memberId,
          baseSalary: salaryInfo.baseSalary,
          currency: payrollRun.baseCurrency,
          adjustments: 0, 
          deductions: 0, 
          description: `Salary payment for ${payrollRun.periodStart.toISOString().slice(0, 7)}`,
        };
        const calculation =
          await this.payrollCalculationService.calculateSimplePayroll(
            calculationInput,
          );
        item.baseSalary = salaryInfo.baseSalary;
        item.baseSalaryCurrency = payrollRun.baseCurrency;
        item.grossAmount = calculation.grossAmount;
        item.adjustments = calculation.adjustments;
        item.deductions = calculation.deductions;
        item.netAmount = calculation.netAmount;
        item.paymentCurrency = payrollRun.baseCurrency;
        item.paymentAmount = calculation.netAmount;
        item.exchangeRate = 1; 
        item.description = calculation.description;
        item.metadata = {
          ...item.metadata,
          payType: salaryInfo.payType,
          paySchedule: salaryInfo.paySchedule,
          employmentId: salaryInfo.employment.id,
        };
        await queryRunner.manager.save(item);
        totalGrossAmount += calculation.grossAmount;
        totalDeductions += calculation.deductions;
        totalNetAmount += calculation.netAmount;
        this.logger.log(
          `Simple payment calculated for member ${item.memberId}: ${calculation.netAmount} ${calculation.currency}`,
        );
      }
      this.logger.log(
        `Simple payroll calculation completed for ${payrollRun.items.length} employees`,
      );
      payrollRun.totalGrossAmount = totalGrossAmount;
      payrollRun.totalDeductions = totalDeductions;
      payrollRun.totalNetAmount = totalNetAmount;
      payrollRun.status = PayrollStatus.PROCESSING;
      payrollRun.metadata = {
        ...payrollRun.metadata,
        calculatedAt: new Date().toISOString(),
        calculatedBy: auditContext.performedById,
        paymentType: 'simple_gross_payment',
      };
      await queryRunner.manager.save(payrollRun);
      await queryRunner.commitTransaction();
      await this.releaseProcessingLock(payrollRunId);
      this.logger.log(
        `Simple payroll calculation completed for run ${payrollRunId}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await this.releaseProcessingLock(payrollRunId);
      this.logger.error(
        `Failed to calculate payroll for run ${payrollRunId}:`,
        error,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
  async approvePayrollRun(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
  ): Promise<PayrollRun> {
    const payrollRun = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items'],
    });
    if (!payrollRun) {
      throw new BadRequestException('Payroll run not found');
    }
    if (payrollRun.status !== PayrollStatus.PROCESSING) {
      throw new BadRequestException(
        `Payroll run must be calculated (PROCESSING) before approval. Current status: ${payrollRun.status}`,
      );
    }
    payrollRun.status = PayrollStatus.APPROVED;
    payrollRun.metadata = {
      ...payrollRun.metadata,
      approvedAt: new Date().toISOString(),
      approvedBy: auditContext.performedById,
    };
    await this.payrollRunRepository.save(payrollRun);
    await this.auditService.logPayrollApproved(auditContext, {
      title: payrollRun.title,
      totalNetAmount: payrollRun.totalNetAmount,
      employeeCount: payrollRun.employeeCount,
    });
    this.logger.log(`Payroll run ${payrollRunId} approved`);
    return payrollRun;
  }

  async disburseManualPayroll(
    dto: ProcessPayrollWithAudit & { confirmed: boolean },
  ): Promise<{ paidCount: number; failedCount: number }> {
    if (!isManualPayrollDisbursement()) {
      throw new BadRequestException(
        'Manual disbursement is disabled. Set PAYROLL_DISBURSEMENT_MODE=manual or use gateway process endpoint.',
      );
    }
    const payrollRun = await this.payrollRunRepository.findOne({
      where: { id: dto.payrollRunId, tenantId: dto.tenantId },
      relations: ['items', 'items.employee'],
    });
    if (!payrollRun) {
      throw new BadRequestException('Payroll run not found');
    }
    return this.manualDisbursementService.disbursePayrollRun(
      payrollRun,
      dto.auditContext,
      dto.confirmed,
    );
  }

  async exportBankFile(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
  ): Promise<string> {
    const payrollRun = await this.payrollExportService.getPayrollRunForExport(
      payrollRunId,
      tenantId,
    );
    if (
      payrollRun.status !== PayrollStatus.PROCESSING &&
      payrollRun.status !== PayrollStatus.APPROVED &&
      payrollRun.status !== PayrollStatus.COMPLETED
    ) {
      throw new BadRequestException(
        'Bank file export requires a calculated payroll run',
      );
    }
    const rows = await this.payrollExportService.buildBankExportRows(payrollRun);
    const csv = this.payrollExportService.toCsv(rows, payrollRun);
    await this.auditService.logPayrollExported(auditContext, {
      exportType: 'bank_csv',
      rowCount: rows.length,
      payrollRunId,
    });
    return csv;
  }

  async getPayslipHtml(
    payrollRunId: string,
    itemId: string,
    tenantId: string,
  ): Promise<string> {
    const payrollRun = await this.payrollExportService.getPayrollRunForExport(
      payrollRunId,
      tenantId,
    );
    const item = payrollRun.items?.find((i) => i.id === itemId);
    if (!item) {
      throw new BadRequestException('Payroll item not found');
    }
    return this.payrollExportService.renderPayslipHtml(payrollRun, item);
  }

  async processPayroll(dto: ProcessPayrollWithAudit): Promise<void> {
    if (isManualPayrollDisbursement()) {
      throw new BadRequestException(
        'Manual disbursement mode: approve the run (POST /runs/:id/approve) then disburse with confirmation (POST /runs/:id/disburse).',
      );
    }
    if (!this.nombaProvider) {
      throw new BadRequestException(
        'Gateway disbursement is not configured. Set PAYROLL_DISBURSEMENT_MODE=manual for offline payroll.',
      );
    }
    const payrollRun = await this.payrollRunRepository.findOne({
      where: { id: dto.payrollRunId, tenantId: dto.tenantId },
      relations: ['items', 'items.employee'],
    });
    if (!payrollRun) {
      throw new BadRequestException('Payroll run not found');
    }
    if (payrollRun.status === PayrollStatus.COMPLETED) {
      this.logger.warn(
        `Attempted to process already completed payroll run: ${dto.payrollRunId}`,
      );
      throw new BadRequestException('Payroll run has already been completed');
    }
    if (payrollRun.status === PayrollStatus.FAILED) {
      throw new BadRequestException(
        'Cannot process a failed payroll run. Please create a new run or reset this one.',
      );
    }
    if (payrollRun.status !== PayrollStatus.PROCESSING) {
      throw new BadRequestException(
        `Payroll run must be in PROCESSING status to be processed. Current status: ${payrollRun.status}`,
      );
    }
    this.logger.log(
      'Payroll calculation completed - ready for payment processing',
    );
    const startTime = Date.now();
    for (const item of payrollRun.items) {
      try {
        await this.processEmployeePayment(item, dto.auditContext);
      } catch (error) {
        this.logger.error(
          `Failed to process payment for employee ${item.memberId}:`,
          error,
        );
        item.status = PayrollItemStatus.FAILED;
        item.failureReason = error.message;
        await this.payrollItemRepository.save(item);
        await this.auditService.logPaymentFailed(
          { ...dto.auditContext, memberId: item.memberId },
          {
            paymentAmount: item.paymentAmount,
            paymentCurrency: item.paymentCurrency,
            paymentProvider: item.paymentProvider,
          },
          error.message,
        );
      }
    }
    payrollRun.status = PayrollStatus.COMPLETED;
    payrollRun.processedAt = new Date();
    await this.payrollRunRepository.save(payrollRun);
    const processingDuration = Date.now() - startTime;
    await this.auditService.logPayrollProcessed(
      dto.auditContext,
      {
        title: payrollRun.title,
        totalGrossAmount: payrollRun.totalGrossAmount,
        totalNetAmount: payrollRun.totalNetAmount,
        employeeCount: payrollRun.employeeCount,
      },
      { processingDuration },
    );
    this.logger.log(
      `Processed payroll run ${dto.payrollRunId} in ${processingDuration}ms`,
    );
  }
  private async processEmployeePayment(
    payrollItem: PayrollItem,
    auditContext: AuditContext,
  ): Promise<void> {
    const paymentMethod = await this.paymentMethodService.findByMemberId(
      payrollItem.memberId,
    );
    if (!paymentMethod) {
      throw new BadRequestException('Payment method not found');
    }
    if (!payrollItem.paymentAmount || payrollItem.paymentAmount <= 0) {
      throw new BadRequestException(
        `Invalid payment amount: ${payrollItem.paymentAmount} for employee ${payrollItem.memberId}`,
      );
    }
    if (payrollItem.paymentAmount > PAYROLL_SECURITY_CONFIG.MAX_PAYMENT_LIMIT) {
      throw new BadRequestException(
        `Payment amount $${payrollItem.paymentAmount.toLocaleString()} exceeds maximum limit of $${PAYROLL_SECURITY_CONFIG.MAX_PAYMENT_LIMIT.toLocaleString()} for employee ${payrollItem.memberId}`,
      );
    }
    if (
      payrollItem.paymentAmount < PAYROLL_SECURITY_CONFIG.MIN_PAYMENT_AMOUNT
    ) {
      throw new BadRequestException(
        `Payment amount $${payrollItem.paymentAmount} is below minimum threshold of $${PAYROLL_SECURITY_CONFIG.MIN_PAYMENT_AMOUNT} for employee ${payrollItem.memberId}`,
      );
    }
    if (
      payrollItem.paymentAmount >=
      PAYROLL_SECURITY_CONFIG.LARGE_PAYMENT_THRESHOLD
    ) {
      await this.auditService.logLargePaymentDetected(
        { ...auditContext, memberId: payrollItem.memberId },
        {
          paymentAmount: payrollItem.paymentAmount,
          paymentCurrency: payrollItem.paymentCurrency,
          threshold: PAYROLL_SECURITY_CONFIG.LARGE_PAYMENT_THRESHOLD,
        },
      );
    }
    await this.auditService.logPaymentAttempt(
      { ...auditContext, memberId: payrollItem.memberId },
      {
        paymentAmount: payrollItem.paymentAmount,
        paymentCurrency: payrollItem.paymentCurrency,
        paymentMethodType: paymentMethod.type,
      },
    );
    const provider = this.getPaymentProvider(paymentMethod);
    const paymentData = {
      amount: payrollItem.paymentAmount,
      currency: payrollItem.paymentCurrency,
      description: `Payroll payment for ${payrollItem.employee?.firstName} ${payrollItem.employee?.lastName}`,
      metadata: {
        memberId: payrollItem.memberId,
        payrollRunId: payrollItem.payrollRunId,
        payrollItemId: payrollItem.id,
      },
    };
    const result = await provider.createPayment(paymentData);
    if (result.success) {
      payrollItem.status = PayrollItemStatus.PAID;
      payrollItem.transactionId = result.transactionId ?? null;
      payrollItem.paymentProvider = provider.constructor.name;
      payrollItem.paidAt = new Date();
      await this.auditService.logPaymentSent(
        { ...auditContext, memberId: payrollItem.memberId },
        {
          paymentAmount: payrollItem.paymentAmount,
          paymentCurrency: payrollItem.paymentCurrency,
          paymentProvider: payrollItem.paymentProvider,
          transactionId: payrollItem.transactionId,
        },
      );
    } else {
      throw new BadRequestException(result.error || 'Payment failed');
    }
    await this.payrollItemRepository.save(payrollItem);
  }
  private getPaymentCurrency(paymentMethod: PaymentMethod): string {
    return paymentMethod.currency || 'USD';
  }
  private getPaymentProvider(_paymentMethod: PaymentMethod): NombaProvider {
    if (!this.nombaProvider) {
      throw new BadRequestException('Payment gateway is not configured');
    }
    return this.nombaProvider;
  }
  private calculatePayPeriodDays(startDate: Date, endDate: Date): number {
    const timeDiff = endDate.getTime() - startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }
  private async acquireProcessingLock(
    payrollRunId: string,
    tenantId: string,
    userId: string,
  ): Promise<PayrollRun | null> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const payrollRun = await queryRunner.query(
        `SELECT * FROM payroll_runs WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
        [payrollRunId, tenantId],
      );
      if (!payrollRun || payrollRun.length === 0) {
        await queryRunner.rollbackTransaction();
        return null;
      }
      const run = payrollRun[0];
      if (run.processing_locked_at && run.processing_locked_by !== userId) {
        const lockAge =
          Date.now() - new Date(run.processing_locked_at).getTime();
        const lockTimeout = 30 * 60 * 1000; 
        if (lockAge < lockTimeout) {
          await queryRunner.rollbackTransaction();
          throw new BadRequestException(
            `Payroll run is currently being processed by another user. Lock expires in ${Math.ceil((lockTimeout - lockAge) / 60000)} minutes.`,
          );
        }
      }
      await queryRunner.query(
        `UPDATE payroll_runs SET processing_locked_at = NOW(), processing_locked_by = $1 WHERE id = $2`,
        [userId, payrollRunId],
      );
      await queryRunner.commitTransaction();
      return this.payrollRunRepository.findOne({
        where: { id: payrollRunId, tenantId },
        relations: ['items', 'items.employee'],
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
  private async releaseProcessingLock(payrollRunId: string): Promise<void> {
    await this.payrollRunRepository.update(payrollRunId, {
      processingLockedAt: null,
      processingLockedById: null,
    });
  }
  async getPayrollRun(
    id: string,
    tenantId: string,
  ): Promise<PayrollRun | null> {
    return this.payrollRunRepository.findOne({
      where: { id, tenantId },
      relations: ['items', 'items.employee', 'createdBy', 'tenant'],
    });
  }
  async getPayrollRuns(
    tenantId: string,
    limit = 20,
    offset = 0,
  ): Promise<{ runs: PayrollRun[]; total: number }> {
    try {
      const { data: runs, total } = await this.payrollRunRepository.paginate({
        where: {
          tenantId: tenantId,
        },
        order: { createdAt: 'DESC' },
        take: limit,
        skip: offset,
        relations: ['createdBy', 'tenant'],
      });
      return { runs: runs, total };
    } catch (error) {
      this.logger.error(
        `Failed to get payroll runs for tenant ${tenantId}`,
        error,
      );
      throw error;
    }
  }
  async previewPayrollCalculation(
    tenantId: string,
    previewDto: PayrollPreviewDto,
    performedById: string,
  ): Promise<{
    employees: PayrollPreviewResult[];
    summary: { totalEmployees: number; totalAmount: number; currency: string };
    warnings: string[];
  }> {
    const warnings: string[] = [];
    const results: PayrollPreviewResult[] = [];
    for (const employeePreview of previewDto.employees) {
      try {
        const salaryInfo = await this.employmentService.getEmploymentSalaryInfo(
          employeePreview.employeeId,
          tenantId,
        );
        const result: PayrollPreviewResult = {
          employeeId: employeePreview.employeeId,
          baseSalary: salaryInfo.baseSalary,
          currency: salaryInfo.currency,
          payType: salaryInfo.payType,
          paySchedule: salaryInfo.paySchedule,
          finalAmount: salaryInfo.baseSalary,
          adjustments: employeePreview.adjustments || [],
        };
        results.push(result);
        if (
          result.finalAmount > PAYROLL_SECURITY_CONFIG.LARGE_PAYMENT_THRESHOLD
        ) {
          warnings.push(
            `Large payment detected for employee ${employeePreview.employeeId}: $${result.finalAmount.toLocaleString()}`,
          );
        }
      } catch (error) {
        warnings.push(
          `Error calculating for employee ${employeePreview.employeeId}: ${error.message}`,
        );
      }
    }
    const summary = {
      totalEmployees: results.length,
      totalAmount: results.reduce((sum, r) => sum + r.finalAmount, 0),
      currency: results[0]?.currency || 'USD',
    };
    return {
      employees: results,
      summary,
      warnings,
    };
  }
}
