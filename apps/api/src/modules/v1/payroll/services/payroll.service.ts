import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { TenantMemberRole } from '../../../../common/enums';
import type { AuditContext } from '../../../../common/interfaces/audit-context.interface';
import type { PaymentProviderInterface } from '../../../../common/interfaces/payment-provider-interface.interface';
import type { PayrollPaymentReadiness } from '../../../../common/interfaces/payroll-payment-readiness.interface';
import { PayrollPaymentIssue } from '../../../../common/interfaces/payroll-payment-readiness.interface';
import type { ProcessPayrollWithAudit } from '../../../../common/interfaces/process-payroll-dto.interface';
import { ManagerAccessService } from '../../../../common/services/manager-access.service';
import { PaymentProviderFactoryService } from '../../../../common/services/payment-provider-factory.service';
import {
  paymentProviderLabel,
  resolvePaymentProvider,
} from '../../../../common/utils/resolve-payment-provider.util';
import { tenantFrontendUrl } from '../../../../common/utils/tenant-frontend-url.util';
import { EmploymentService } from '../../employment/employment.service';
import { NotificationHelperService } from '../../notifications/services/notification-helper.service';
import { PaymentMethodService } from '../../payment-method/services/payment-method.service';
import { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import { TenantsService } from '../../tenants/tenants.service';
import { isPayrollGatewayEnabled } from '../config/payroll-disbursement.config';
import type { PayrollItem } from '../entities/payroll-item.entity';
import type { PayrollRun } from '../entities/payroll-run.entity';
import { AuditService } from './audit.service';
import { ManualDisbursementService } from './manual-disbursement.service';
import { MultiPaymentService } from './multi-payment.service';
import { PayrollCalculationService } from './payroll-calculation.service';
import { PayrollExportService } from './payroll-export.service';

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

import type { PayrollFrequency } from '../../../../common/enums/payroll-frequency.enum';
import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { PayrollStatus } from '../../../../common/enums/payroll-status.enum';
import type { SimplePayrollInput } from '../../../../common/interfaces/simple-payroll-input.interface';
import type { PaymentMethod } from '../../payment-method/entities/payment-method.entity';
import { PAYROLL_SECURITY_CONFIG } from '../config/security.config';
import type { CreatePayrollRunDto } from '../dto/create-payroll-run.dto';
import type { PayrollAdjustmentDto } from '../dto/payroll-adjustment.dto';
import type { UpdatePayrollItemDto } from '../dto/update-payroll-item.dto';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import {
  aggregatePayrollAdjustments,
  collectAdjustmentsForEmployee,
} from '../utils/payroll-adjustment.util';
import { assertPayrollRunMutable } from '../utils/payroll-mutability.util';
import { buildPayrollPaymentData } from '../utils/payroll-payment.util';
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
    private readonly tenantSettingsService: TenantSettingsService,
    private readonly tenantsService: TenantsService,
    private readonly manualDisbursementService: ManualDisbursementService,
    private readonly payrollExportService: PayrollExportService,
    private readonly managerAccessService: ManagerAccessService,
    private readonly multiPaymentService: MultiPaymentService,
    @Optional() private readonly paymentProviderFactory?: PaymentProviderFactoryService,
    @Optional() private readonly notificationHelper?: NotificationHelperService,
  ) {}
  async createPayrollRun(
    dto: CreatePayrollRunDto,
    tenantId: string,
    createdById: string,
    idempotencyKey?: string,
  ): Promise<PayrollRun & { alreadyExists?: boolean }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const finalIdempotencyKey =
        idempotencyKey ||
        `${tenantId}-${dto.periodStart.toISOString()}-${dto.periodEnd.toISOString()}`;
      await queryRunner.query(`SELECT id FROM tenants WHERE id = $1 FOR UPDATE`, [tenantId]);
      if (finalIdempotencyKey) {
        const existingByKey = await this.payrollRunRepository.findOne({
          where: { idempotencyKey: finalIdempotencyKey },
        });
        if (existingByKey) {
          await queryRunner.rollbackTransaction();
          return Object.assign(existingByKey, { alreadyExists: true });
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
        await queryRunner.rollbackTransaction();
        return Object.assign(existingRun, { alreadyExists: true });
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
        payoutMode: null,
      };
      const savedPayrollRun = await this.payrollRunRepository.create(payrollRunData);
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
        { tenantId, payrollRunId: savedPayrollRun.id, performedById: createdById },
        {
          title: dto.title,
          frequency: dto.frequency,
          employeeCount: dto.employeeIds.length,
          baseCurrency: dto.baseCurrency,
        },
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
  ): Promise<{ warnings: string[]; readiness: PayrollPaymentReadiness[] }> {
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
    assertPayrollRunMutable(payrollRun, 'recalculate');
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const employeeIds = payrollRun.items.map((item) => item.memberId);
      const salaryInfoMap = await this.employmentService.getBulkEmploymentSalaryInfo(
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
      const warnings: string[] = [];
      const readinessResults: PayrollPaymentReadiness[] = [];
      for (const item of payrollRun.items) {
        const excluded = Boolean(item.metadata?.excludedFromRun);
        const readiness = await this.paymentMethodService.assessPayrollReadiness(
          tenantId,
          item.memberId,
          payrollRun.baseCurrency,
          excluded,
        );
        readinessResults.push(readiness);
        if (!readiness.ready && !excluded) {
          warnings.push(readiness.message);
        }

        const paymentMethod = readiness.paymentMethodId
          ? await this.paymentMethodService.findById(readiness.paymentMethodId)
          : await this.paymentMethodService.resolvePayrollPaymentMethod(
              tenantId,
              item.memberId,
              payrollRun.baseCurrency,
            );
        const salaryInfo = salaryInfoMap.get(item.memberId);
        if (!salaryInfo) {
          throw new BadRequestException(
            `No employment record found for employee ${item.memberId}. Please ensure employee has an active employment record with salary information.`,
          );
        }

        const salaryCurrency = (salaryInfo.currency || payrollRun.baseCurrency).toUpperCase();
        const runCurrency = payrollRun.baseCurrency.toUpperCase();
        if (salaryCurrency !== runCurrency) {
          const mismatchReadiness: PayrollPaymentReadiness = {
            memberId: item.memberId,
            ready: false,
            issues: [PayrollPaymentIssue.CURRENCY_MISMATCH],
            message: `Salary currency ${salaryCurrency} does not match this run (${runCurrency}). Create a separate ${salaryCurrency} run or update their salary currency.`,
            currency: salaryCurrency,
          };
          readinessResults[readinessResults.length - 1] = mismatchReadiness;
          warnings.push(mismatchReadiness.message);
          item.baseSalary = salaryInfo.baseSalary;
          item.baseSalaryCurrency = salaryCurrency;
          item.grossAmount = 0;
          item.adjustments = 0;
          item.deductions = 0;
          item.netAmount = 0;
          item.paymentCurrency = runCurrency;
          item.paymentAmount = 0;
          item.exchangeRate = 1;
          item.status = PayrollItemStatus.CANCELLED;
          item.failureReason = mismatchReadiness.message;
          item.metadata = {
            ...item.metadata,
            payType: salaryInfo.payType,
            paySchedule: salaryInfo.paySchedule,
            employmentId: salaryInfo.employment.id,
            salaryCurrency,
            paymentReadiness: mismatchReadiness,
            excludedFromRun: true,
          };
          await queryRunner.manager.save(item);
          continue;
        }

        const employeeAdjustments = collectAdjustmentsForEmployee(
          item.memberId,
          adjustments,
          item.metadata ?? undefined,
        );
        const { adjustments: bonusTotal, deductions: deductionTotal } = aggregatePayrollAdjustments(
          employeeAdjustments,
          salaryInfo.baseSalary,
        );
        const calculationInput: SimplePayrollInput = {
          memberId: item.memberId,
          baseSalary: salaryInfo.baseSalary,
          currency: payrollRun.baseCurrency,
          adjustments: bonusTotal,
          deductions: deductionTotal,
          description: `Salary payment for ${this.toIsoDatePart(payrollRun.periodStart).slice(0, 7)}`,
        };
        const calculation =
          await this.payrollCalculationService.calculateSimplePayroll(calculationInput);
        item.baseSalary = salaryInfo.baseSalary;
        item.baseSalaryCurrency = salaryCurrency;
        item.grossAmount = calculation.grossAmount;
        item.adjustments = calculation.adjustments;
        item.deductions = calculation.deductions;
        item.netAmount = calculation.netAmount;
        item.paymentCurrency = runCurrency;
        item.paymentAmount = calculation.netAmount;
        item.exchangeRate = 1;
        item.description = calculation.description;
        item.metadata = {
          ...item.metadata,
          payType: salaryInfo.payType,
          paySchedule: salaryInfo.paySchedule,
          employmentId: salaryInfo.employment.id,
          salaryCurrency,
          paymentReadiness: readiness,
          excludedFromRun: excluded,
          adjustmentLines: employeeAdjustments,
        };
        if (paymentMethod?.id) {
          item.paymentMethodId = paymentMethod.id;
        }
        if (excluded || !readiness.ready) {
          item.status = PayrollItemStatus.CANCELLED;
          item.failureReason = excluded
            ? 'Excluded from payroll run by administrator'
            : readiness.message;
        } else {
          item.status = PayrollItemStatus.PENDING;
          item.failureReason = null;
        }
        await queryRunner.manager.save(item);
        if (!excluded && readiness.ready) {
          totalGrossAmount += calculation.grossAmount;
          totalDeductions += calculation.deductions;
          totalNetAmount += calculation.netAmount;
        }
      }
      payrollRun.totalGrossAmount = totalGrossAmount;
      payrollRun.totalDeductions = totalDeductions;
      payrollRun.totalNetAmount = totalNetAmount;
      payrollRun.status = PayrollStatus.PROCESSING;
      payrollRun.metadata = {
        ...payrollRun.metadata,
        calculatedAt: new Date().toISOString(),
        calculatedBy: auditContext.performedById,
        paymentType: 'simple_gross_payment',
        readinessWarnings: warnings,
        readiness: readinessResults,
      };
      await queryRunner.manager.save(payrollRun);
      await queryRunner.commitTransaction();
      await this.releaseProcessingLock(payrollRunId);

      // Auto-notify employees missing payment details (best-effort, once per calculate).
      void this.notifyNotReadyEmployeesAfterCalculate(payrollRunId, tenantId, readinessResults);

      return { warnings, readiness: readinessResults };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await this.releaseProcessingLock(payrollRunId);
      this.logger.error(`Failed to calculate payroll for run ${payrollRunId}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async notifyNotReadyEmployeesAfterCalculate(
    payrollRunId: string,
    tenantId: string,
    readinessResults: PayrollPaymentReadiness[],
  ): Promise<void> {
    if (!this.notificationHelper) return;
    const payrollRun = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items', 'items.employee'],
    });
    if (!payrollRun?.items?.length) return;

    const todayKey = new Date().toISOString().slice(0, 10);
    for (const readiness of readinessResults) {
      if (readiness.ready) continue;
      const notifyIssues: PayrollPaymentIssue[] = [
        PayrollPaymentIssue.MISSING_PAYMENT_METHOD,
        PayrollPaymentIssue.INCOMPLETE_BANK_DETAILS,
        PayrollPaymentIssue.UNVERIFIED_PAYMENT_METHOD,
      ];
      if (!readiness.issues.some((issue) => notifyIssues.includes(issue))) continue;

      const item = payrollRun.items.find((entry) => entry.memberId === readiness.memberId);
      if (!item?.employee?.userId) continue;

      const lastNotified = item.metadata?.paymentSetupNotifiedOn;
      if (lastNotified === todayKey) continue;

      try {
        const employeeName =
          `${item.employee.firstName ?? ''} ${item.employee.lastName ?? ''}`.trim() || 'there';
        await this.notificationHelper.sendPayrollPaymentSetupReminder(
          item.employee.userId,
          tenantId,
          {
            employeeName,
            payrollPeriod: this.formatPayrollPeriod(payrollRun.periodStart, payrollRun.periodEnd),
            message: readiness.message,
          },
        );
        item.metadata = {
          ...item.metadata,
          paymentSetupNotifiedOn: todayKey,
        };
        await this.payrollItemRepository.save(item);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Failed to auto-notify payment setup for member ${readiness.memberId}: ${message}`,
        );
      }
    }
  }

  async schedulePayrollPayout(
    payrollRunId: string,
    tenantId: string,
    paymentDate?: Date,
  ): Promise<PayrollRun> {
    const payrollRun = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
    });
    if (!payrollRun) {
      throw new BadRequestException('Payroll run not found');
    }
    if (payrollRun.status !== PayrollStatus.APPROVED) {
      throw new BadRequestException(
        `Only approved runs can be scheduled. Current status: ${payrollRun.status}`,
      );
    }
    if (paymentDate) {
      payrollRun.paymentDate = paymentDate;
    }
    if (!payrollRun.paymentDate) {
      throw new BadRequestException('Set a payment date before scheduling');
    }
    payrollRun.payoutMode = 'scheduled';
    payrollRun.metadata = {
      ...payrollRun.metadata,
      scheduledAt: new Date().toISOString(),
      scheduledFor: this.toIsoDatePart(payrollRun.paymentDate),
    };
    return this.payrollRunRepository.save(payrollRun);
  }

  async payNowPayroll(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
  ): Promise<unknown> {
    const payrollRun = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
    });
    if (!payrollRun) {
      throw new BadRequestException('Payroll run not found');
    }
    if (payrollRun.status !== PayrollStatus.APPROVED) {
      throw new BadRequestException(
        `Only approved runs can be paid now. Current status: ${payrollRun.status}`,
      );
    }
    payrollRun.payoutMode = 'immediate';
    await this.payrollRunRepository.save(payrollRun);
    return this.multiPaymentService.processMultiPaymentPayroll(
      payrollRunId,
      tenantId,
      auditContext,
    );
  }

  async processDueScheduledPayouts(): Promise<{ processed: number; failed: number }> {
    if (!isPayrollGatewayEnabled()) {
      return { processed: 0, failed: 0 };
    }
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const dueRuns = await this.payrollRunRepository
      .createQueryBuilder('run')
      .where('run.status = :status', { status: PayrollStatus.APPROVED })
      .andWhere('run.payout_mode = :mode', { mode: 'scheduled' })
      .andWhere('run.payment_date <= :today', {
        today: today.toISOString().slice(0, 10),
      })
      .getMany();

    let processed = 0;
    let failed = 0;
    for (const run of dueRuns) {
      try {
        await this.multiPaymentService.processMultiPaymentPayroll(run.id, run.tenantId, {
          tenantId: run.tenantId,
          payrollRunId: run.id,
          performedById: run.createdById,
        });
        processed += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Scheduled payout failed for run ${run.id}: ${message}`);
      }
    }
    return { processed, failed };
  }

  async approvePayroll(
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

    const readiness = await this.getPayrollReadiness(payrollRunId, tenantId);
    const notReady = readiness.items.filter(
      (item) => !item.ready && !item.issues.includes(PayrollPaymentIssue.EXCLUDED_FROM_RUN),
    );
    if (notReady.length > 0) {
      throw new BadRequestException(
        `${notReady.length} employee(s) are not ready for payout. Remove them from the run or notify them to complete payment settings.`,
      );
    }

    payrollRun.status = PayrollStatus.APPROVED;
    payrollRun.metadata = {
      ...payrollRun.metadata,
      approvedAt: new Date().toISOString(),
      approvedBy: auditContext.performedById,
    };
    for (const item of payrollRun.items ?? []) {
      if (item.status === PayrollItemStatus.CANCELLED) continue;
      item.metadata = {
        ...item.metadata,
        lockedAt: new Date().toISOString(),
      };
      await this.payrollItemRepository.save(item);
    }
    await this.payrollRunRepository.save(payrollRun);
    await this.auditService.logPayrollApproved(auditContext, {
      title: payrollRun.title,
      totalNetAmount: payrollRun.totalNetAmount,
      employeeCount: payrollRun.employeeCount,
    });
    return payrollRun;
  }

  async disburseManualPayroll(
    dto: ProcessPayrollWithAudit & { confirmed: boolean },
  ): Promise<{ paidCount: number; failedCount: number }> {
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
      throw new BadRequestException('Bank file export requires a calculated payroll run');
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
    requesterMemberId?: string,
    requesterRole?: string,
  ): Promise<string> {
    const { payrollRun, item } = await this.getPaidPayslipItem(
      payrollRunId,
      itemId,
      tenantId,
      requesterMemberId,
      requesterRole,
    );
    return this.payrollExportService.renderPayslipHtml(payrollRun, item);
  }

  async getPayslipPdf(
    payrollRunId: string,
    itemId: string,
    tenantId: string,
    requesterMemberId: string,
    requesterRole: string,
  ): Promise<Buffer> {
    const { payrollRun, item } = await this.getPaidPayslipItem(
      payrollRunId,
      itemId,
      tenantId,
      requesterMemberId,
      requesterRole,
    );
    return this.payrollExportService.renderPayslipPdf(payrollRun, item);
  }

  async getMemberPublishedPayslips(
    memberId: string,
    tenantId: string,
    requesterMemberId: string,
    requesterRole: string,
  ) {
    await this.assertPayrollMemberAccess(tenantId, memberId, requesterMemberId, requesterRole);

    const items = await this.payrollItemRepository.find({
      where: {
        memberId,
        status: PayrollItemStatus.PAID,
      },
      relations: ['payrollRun', 'employee'],
      order: { paidAt: 'DESC' },
    });

    return items
      .filter(
        (item) =>
          item.payrollRun?.tenantId === tenantId && Boolean(item.metadata?.payslipPublished),
      )
      .map((item) => {
        const employee = item.employee;
        const employeeName = employee
          ? `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim()
          : item.memberId;
        const payrollRun = item.payrollRun;
        return {
          itemId: item.id,
          runId: item.payrollRunId,
          memberId: item.memberId,
          employeeName: employeeName || 'Unknown',
          runTitle: payrollRun?.title ?? 'Payroll',
          periodStart: payrollRun?.periodStart,
          periodEnd: payrollRun?.periodEnd,
          netAmount: item.netAmount,
          currency: payrollRun?.baseCurrency,
          paidAt: item.paidAt,
          publishedAt: item.metadata?.payslipPublishedAt as string | undefined,
        };
      });
  }

  private async getPaidPayslipItem(
    payrollRunId: string,
    itemId: string,
    tenantId: string,
    requesterMemberId?: string,
    requesterRole?: string,
  ): Promise<{ payrollRun: PayrollRun; item: PayrollItem }> {
    const payrollRun = await this.payrollExportService.getPayrollRunForExport(
      payrollRunId,
      tenantId,
    );
    const item = payrollRun.items?.find((entry) => entry.id === itemId);
    if (!item) {
      throw new BadRequestException('Payroll item not found');
    }
    if (item.status !== PayrollItemStatus.PAID) {
      throw new BadRequestException('Payslip is only available for paid payroll items');
    }

    if (requesterMemberId && requesterRole) {
      const isAdmin = this.isPayrollAdmin(requesterRole);
      const isOwner = item.memberId === requesterMemberId;
      const isPublished = Boolean(item.metadata?.payslipPublished);
      if (!isAdmin && !isOwner) {
        const isManager = await this.managerAccessService.isManagerOf(
          tenantId,
          requesterMemberId,
          item.memberId,
        );
        if (!isManager) {
          throw new ForbiddenException('This payslip is not available yet');
        }
      } else if (!isAdmin && (!isOwner || !isPublished)) {
        throw new ForbiddenException('This payslip is not available yet');
      }
    }

    return { payrollRun, item };
  }

  async processPayroll(dto: ProcessPayrollWithAudit): Promise<void> {
    if (!isPayrollGatewayEnabled()) {
      throw new BadRequestException(
        'Payroll gateway is not configured. Use manual disburse or configure Nomba (NGN) and/or Noah credentials.',
      );
    }
    if (!this.paymentProviderFactory) {
      throw new BadRequestException('Payroll payment gateway is not configured.');
    }
    const payrollRun = await this.payrollRunRepository.findOne({
      where: { id: dto.payrollRunId, tenantId: dto.tenantId },
      relations: ['items', 'items.employee', 'tenant'],
    });
    if (!payrollRun) {
      throw new BadRequestException('Payroll run not found');
    }
    if (payrollRun.status === PayrollStatus.COMPLETED) {
      this.logger.warn(`Attempted to process already completed payroll run: ${dto.payrollRunId}`);
      throw new BadRequestException('Payroll run has already been completed');
    }
    if (payrollRun.status === PayrollStatus.FAILED) {
      throw new BadRequestException(
        'Cannot process a failed payroll run. Please create a new run or reset this one.',
      );
    }
    if (
      payrollRun.status !== PayrollStatus.APPROVED &&
      payrollRun.status !== PayrollStatus.PROCESSING
    ) {
      throw new BadRequestException(
        `Payroll run must be approved before payout. Current status: ${payrollRun.status}`,
      );
    }
    const startTime = Date.now();
    for (const item of payrollRun.items) {
      try {
        await this.processEmployeePayment(item, dto.auditContext, payrollRun);
      } catch (error) {
        this.logger.error(`Failed to process payment for employee ${item.memberId}:`, error);
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
  }
  private async processEmployeePayment(
    payrollItem: PayrollItem,
    auditContext: AuditContext,
    payrollRun: PayrollRun,
  ): Promise<void> {
    if (payrollItem.status === PayrollItemStatus.CANCELLED) {
      return;
    }

    const readiness = await this.paymentMethodService.assessPayrollReadiness(
      payrollRun.tenantId,
      payrollItem.memberId,
      payrollItem.paymentCurrency,
      Boolean(payrollItem.metadata?.excludedFromRun),
    );
    if (!readiness.ready || !readiness.paymentMethodId) {
      throw new BadRequestException(readiness.message);
    }

    const paymentMethod = await this.paymentMethodService.findById(readiness.paymentMethodId);
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
    if (payrollItem.paymentAmount < PAYROLL_SECURITY_CONFIG.MIN_PAYMENT_AMOUNT) {
      throw new BadRequestException(
        `Payment amount $${payrollItem.paymentAmount} is below minimum threshold of $${PAYROLL_SECURITY_CONFIG.MIN_PAYMENT_AMOUNT} for employee ${payrollItem.memberId}`,
      );
    }
    if (payrollItem.paymentAmount >= PAYROLL_SECURITY_CONFIG.LARGE_PAYMENT_THRESHOLD) {
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
    const employeeName = payrollItem.employee
      ? `${payrollItem.employee.firstName ?? ''} ${payrollItem.employee.lastName ?? ''}`.trim()
      : payrollItem.memberId;
    const paymentData = buildPayrollPaymentData(
      payrollItem,
      paymentMethod,
      employeeName,
      payrollRun.tenant?.name,
    );
    const result = await provider.createPayment(paymentData);
    if (result.success) {
      payrollItem.status = PayrollItemStatus.PAID;
      payrollItem.transactionId = result.transactionId ?? null;
      payrollItem.paymentProvider = paymentProviderLabel(
        resolvePaymentProvider(payrollItem.paymentCurrency, paymentMethod.type),
      );
      payrollItem.paymentMethodId = paymentMethod.id;
      payrollItem.paidAt = new Date();
      await this.paymentMethodService.recordPaymentMethodUsage(paymentMethod.id);
      await this.auditService.logPaymentSent(
        { ...auditContext, memberId: payrollItem.memberId },
        {
          paymentAmount: payrollItem.paymentAmount,
          paymentCurrency: payrollItem.paymentCurrency,
          paymentProvider: payrollItem.paymentProvider,
          transactionId: payrollItem.transactionId,
        },
      );
      if (payrollItem.employee?.id && this.notificationHelper) {
        await this.notificationHelper.sendPayrollNotification(
          payrollItem.employee.id,
          payrollRun.tenantId,
          {
            employeeName,
            payrollPeriod: this.formatPayrollPeriod(payrollRun.periodStart, payrollRun.periodEnd),
            amount: Number(payrollItem.paymentAmount),
            currency: payrollItem.paymentCurrency,
          },
        );
      }
    } else {
      throw new BadRequestException(result.error || 'Payment failed');
    }
    await this.payrollItemRepository.save(payrollItem);
  }
  private getPaymentProvider(paymentMethod: PaymentMethod): PaymentProviderInterface {
    if (!this.paymentProviderFactory) {
      throw new BadRequestException('Payment gateway is not configured');
    }
    return this.paymentProviderFactory.getFiatProvider(
      paymentMethod.currency ?? 'NGN',
      paymentMethod.type,
    );
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
        const lockAge = Date.now() - new Date(run.processing_locked_at).getTime();
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
  private isPayrollAdmin(requesterRole: string): boolean {
    return requesterRole === TenantMemberRole.ADMIN || requesterRole === TenantMemberRole.OWNER;
  }

  private async assertPayrollMemberAccess(
    tenantId: string,
    targetMemberId: string,
    requesterMemberId: string,
    requesterRole: string,
  ): Promise<void> {
    if (this.isPayrollAdmin(requesterRole) || targetMemberId === requesterMemberId) {
      return;
    }
    const isManager = await this.managerAccessService.isManagerOf(
      tenantId,
      requesterMemberId,
      targetMemberId,
    );
    if (!isManager) {
      throw new ForbiddenException(
        'You can only access payroll for yourself or your direct reports',
      );
    }
  }

  async getPayrollRunsForRequester(
    tenantId: string,
    limit: number,
    offset: number,
    requesterMemberId: string,
    requesterRole: string,
  ): Promise<{ runs: PayrollRun[]; total: number }> {
    if (this.isPayrollAdmin(requesterRole)) {
      return this.getPayrollRuns(tenantId, limit, offset);
    }
    const directReports = await this.managerAccessService.getDirectReportIds(
      tenantId,
      requesterMemberId,
    );
    if (directReports.length === 0) {
      throw new ForbiddenException('Admin or manager access required');
    }
    const items = await this.payrollItemRepository.find({
      where: { memberId: In(directReports) },
      select: ['payrollRunId'],
    });
    const runIds = [...new Set(items.map((item) => item.payrollRunId))];
    if (runIds.length === 0) {
      return { runs: [], total: 0 };
    }
    const { data: runs, total } = await this.payrollRunRepository.paginate({
      where: { tenantId, id: In(runIds) },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
      relations: ['createdBy', 'tenant'],
    });
    return { runs, total };
  }

  async getPayrollRunForRequester(
    id: string,
    tenantId: string,
    requesterMemberId: string,
    requesterRole: string,
  ): Promise<PayrollRun | null> {
    const payrollRun = await this.getPayrollRun(id, tenantId);
    if (!payrollRun) {
      return null;
    }
    if (this.isPayrollAdmin(requesterRole)) {
      return payrollRun;
    }
    const directReports = await this.managerAccessService.getDirectReportIds(
      tenantId,
      requesterMemberId,
    );
    if (directReports.length === 0) {
      throw new ForbiddenException('Admin or manager access required');
    }
    const teamItems = (payrollRun.items ?? []).filter((item) =>
      directReports.includes(item.memberId),
    );
    if (teamItems.length === 0) {
      throw new ForbiddenException('You can only access payroll runs for your direct reports');
    }
    payrollRun.items = teamItems;
    return payrollRun;
  }

  async getPayrollRun(id: string, tenantId: string): Promise<PayrollRun | null> {
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
      this.logger.error(`Failed to get payroll runs for tenant ${tenantId}`, error);
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
        if (result.finalAmount > PAYROLL_SECURITY_CONFIG.LARGE_PAYMENT_THRESHOLD) {
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

  async getPayrollReadiness(payrollRunId: string, tenantId: string) {
    const payrollRun = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items', 'items.employee'],
    });
    if (!payrollRun) {
      throw new BadRequestException('Payroll run not found');
    }

    const items: Array<
      PayrollPaymentReadiness & {
        itemId: string;
        employeeName: string;
        netAmount: number;
        status: PayrollItemStatus;
      }
    > = [];

    for (const item of payrollRun.items ?? []) {
      const employeeName = item.employee
        ? `${item.employee.firstName ?? ''} ${item.employee.lastName ?? ''}`.trim()
        : item.memberId;
      const readiness = await this.paymentMethodService.assessPayrollReadiness(
        tenantId,
        item.memberId,
        payrollRun.baseCurrency,
        Boolean(item.metadata?.excludedFromRun),
      );
      items.push({
        ...readiness,
        itemId: item.id,
        employeeName: employeeName || 'Unknown',
        netAmount: Number(item.netAmount ?? 0),
        status: item.status,
      });
    }

    const readyCount = items.filter((item) => item.ready).length;
    const notReadyCount = items.length - readyCount;

    return {
      payrollRunId,
      currency: payrollRun.baseCurrency,
      totalEmployees: items.length,
      readyCount,
      notReadyCount,
      canApprove: notReadyCount === 0,
      items,
    };
  }

  async removePayrollItem(
    payrollRunId: string,
    itemId: string,
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
    assertPayrollRunMutable(payrollRun, 'remove');

    const item = payrollRun.items?.find((entry) => entry.id === itemId);
    if (!item) {
      throw new BadRequestException('Payroll item not found');
    }

    item.status = PayrollItemStatus.CANCELLED;
    item.failureReason = 'Excluded from payroll run by administrator';
    item.metadata = {
      ...item.metadata,
      excludedFromRun: true,
    };
    await this.payrollItemRepository.save(item);

    const activeItems = (payrollRun.items ?? []).filter(
      (entry) => entry.id !== itemId && entry.status !== PayrollItemStatus.CANCELLED,
    );
    payrollRun.employeeCount = activeItems.length;
    payrollRun.totalGrossAmount = activeItems.reduce(
      (sum, entry) => sum + Number(entry.grossAmount ?? 0),
      0,
    );
    payrollRun.totalDeductions = activeItems.reduce(
      (sum, entry) => sum + Number(entry.deductions ?? 0),
      0,
    );
    payrollRun.totalNetAmount = activeItems.reduce(
      (sum, entry) => sum + Number(entry.netAmount ?? 0),
      0,
    );
    await this.payrollRunRepository.save(payrollRun);

    await this.auditService.logAdjustmentCalculated(auditContext, {
      action: 'remove_employee',
      itemId,
      memberId: item.memberId,
    });

    return payrollRun;
  }

  async updatePayrollItem(
    payrollRunId: string,
    itemId: string,
    tenantId: string,
    dto: UpdatePayrollItemDto,
    auditContext: AuditContext,
  ): Promise<PayrollRun> {
    const payrollRun = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items'],
    });
    if (!payrollRun) {
      throw new BadRequestException('Payroll run not found');
    }
    assertPayrollRunMutable(payrollRun, 'edit');

    const item = payrollRun.items?.find((entry) => entry.id === itemId);
    if (!item) {
      throw new BadRequestException('Payroll item not found');
    }
    if (item.status === PayrollItemStatus.CANCELLED) {
      throw new BadRequestException('Cannot edit a cancelled payroll item');
    }

    if (dto.adjustmentLines !== undefined) {
      item.metadata = {
        ...item.metadata,
        adjustmentLines: dto.adjustmentLines,
      };
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

  async notifyEmployeePaymentSetup(
    payrollRunId: string,
    itemId: string,
    tenantId: string,
    requesterMemberId?: string,
    requesterRole?: string,
  ): Promise<{ notified: boolean }> {
    const payrollRun = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items', 'items.employee'],
    });
    if (!payrollRun) {
      throw new BadRequestException('Payroll run not found');
    }

    const item = payrollRun.items?.find((entry) => entry.id === itemId);
    if (!item?.employee?.userId) {
      throw new BadRequestException('Employee not found for notification');
    }

    if (requesterMemberId && requesterRole) {
      await this.assertPayrollMemberAccess(
        tenantId,
        item.memberId,
        requesterMemberId,
        requesterRole,
      );
    }

    const readiness = await this.paymentMethodService.assessPayrollReadiness(
      tenantId,
      item.memberId,
      payrollRun.baseCurrency,
      Boolean(item.metadata?.excludedFromRun),
    );
    if (readiness.ready) {
      throw new BadRequestException('Employee payment settings are already complete');
    }

    if (!this.notificationHelper) {
      throw new BadRequestException('Notification service is unavailable');
    }

    const employeeName =
      `${item.employee.firstName ?? ''} ${item.employee.lastName ?? ''}`.trim() || 'there';
    await this.notificationHelper.sendPayrollPaymentSetupReminder(item.employee.userId, tenantId, {
      employeeName,
      payrollPeriod: this.formatPayrollPeriod(payrollRun.periodStart, payrollRun.periodEnd),
      message: readiness.message,
    });

    return { notified: true };
  }

  async getRunPayslips(payrollRunId: string, tenantId: string) {
    const payrollRun = await this.getPayrollRun(payrollRunId, tenantId);
    if (!payrollRun) {
      throw new BadRequestException('Payroll run not found');
    }

    return (payrollRun.items ?? [])
      .filter((item) => item.status === PayrollItemStatus.PAID)
      .map((item) => {
        const employee = item.employee;
        const employeeName = employee
          ? `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim()
          : item.memberId;

        return {
          itemId: item.id,
          runId: payrollRunId,
          memberId: item.memberId,
          employeeName: employeeName || 'Unknown',
          published: Boolean(item.metadata?.payslipPublished),
          paidAt: item.paidAt,
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
    const payrollRun = await this.getPayrollRun(payrollRunId, tenantId);
    if (!payrollRun) {
      throw new BadRequestException('Payroll run not found');
    }

    if (requesterMemberId && requesterRole && !this.isPayrollAdmin(requesterRole)) {
      const directReports = await this.managerAccessService.getDirectReportIds(
        tenantId,
        requesterMemberId,
      );
      if (directReports.length === 0) {
        throw new ForbiddenException('Admin or manager access required');
      }
      if (itemIds?.length) {
        const invalidItems = (payrollRun.items ?? []).filter(
          (item) => itemIds.includes(item.id) && !directReports.includes(item.memberId),
        );
        if (invalidItems.length > 0) {
          throw new ForbiddenException('You can only publish payslips for your direct reports');
        }
      }
    }

    const shouldSendEmail = sendEmail ?? (await this.resolveEmailPayslipOnPublish(tenantId));

    let allowedMemberIds: string[] | undefined;
    if (requesterMemberId && requesterRole && !this.isPayrollAdmin(requesterRole)) {
      allowedMemberIds = await this.managerAccessService.getDirectReportIds(
        tenantId,
        requesterMemberId,
      );
      if (allowedMemberIds.length === 0) {
        throw new ForbiddenException('Admin or manager access required');
      }
    }

    const items = (payrollRun.items ?? []).filter((item) => {
      if (item.status !== PayrollItemStatus.PAID) return false;
      if (itemIds?.length && !itemIds.includes(item.id)) return false;
      if (allowedMemberIds && !allowedMemberIds.includes(item.memberId)) return false;
      return true;
    });

    const publishedItemIds: string[] = [];
    const tenant = await this.tenantsService.getTenant(tenantId);
    const payrollPeriod = this.formatPayrollPeriod(payrollRun.periodStart, payrollRun.periodEnd);

    for (const item of items) {
      item.metadata = {
        ...item.metadata,
        payslipPublished: true,
        payslipPublishedAt: new Date().toISOString(),
      };
      await this.payrollItemRepository.save(item);
      publishedItemIds.push(item.id);

      if (shouldSendEmail && item.employee?.id && this.notificationHelper) {
        const employeeName =
          `${item.employee.firstName ?? ''} ${item.employee.lastName ?? ''}`.trim() || 'there';
        const profileUrl = tenantFrontendUrl(
          tenant.slug,
          `/employees/${item.memberId}?tab=documents`,
        );
        await this.notificationHelper.sendPayslipPublishedNotification(item.memberId, tenantId, {
          employeeName,
          payrollPeriod,
          profileUrl,
          payrollRunId,
        });
      }
    }

    if (publishedItemIds.length > 0) {
      await this.auditService.logPayslipsPublished(auditContext, {
        itemIds: publishedItemIds,
        documentIds: [],
        sendEmail: shouldSendEmail,
        publishedCount: publishedItemIds.length,
      });
    }

    return { publishedCount: publishedItemIds.length, itemIds: publishedItemIds };
  }

  private toIsoDatePart(value: Date | string): string {
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    return String(value).slice(0, 10);
  }

  private formatPayrollPeriod(periodStart: Date | string, periodEnd: Date | string): string {
    return `${this.toIsoDatePart(periodStart)} – ${this.toIsoDatePart(periodEnd)}`;
  }

  private async resolveEmailPayslipOnPublish(tenantId: string): Promise<boolean> {
    try {
      const settings = await this.tenantSettingsService.getTenantSettings(tenantId);
      return settings.settings.general?.emailPayslipOnPublish ?? false;
    } catch {
      return false;
    }
  }
}
