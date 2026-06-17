import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { AuditContext } from 'src/common/interfaces/audit-context.interface';
import { NombaProvider } from 'src/common/providers/nomba.provider';
import { DataSource } from 'typeorm';
import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { PayrollStatus } from '../../../../common/enums/payroll-status.enum';
import type { BatchPaymentResult } from '../../../../common/interfaces/batch-payment-result.interface';
import type { PaymentBatch } from '../../../../common/interfaces/payment-batch.interface';
import type { PaymentResult } from '../../../../common/interfaces/payment-result.interface';
import { PaymentMethodService } from '../../payment-method/services/payment-method.service';
import { isPayrollGatewayEnabled } from '../config/payroll-disbursement.config';
import type { PayrollItem } from '../entities/payroll-item.entity';
import type { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollPayoutService } from './payroll-payout.service';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { buildPayrollPaymentData } from '../utils/payroll-payment.util';

interface PaymentSummary {
  fiatSuccess: number;
  fiatFailed: number;
}

@Injectable()
export class MultiPaymentService {
  private readonly logger = new Logger(MultiPaymentService.name);
  constructor(
    private readonly payrollRunRepository: PayrollRunRepository,
    private readonly payrollItemRepository: PayrollItemRepository,
    private readonly paymentMethodService: PaymentMethodService,
    readonly _dataSource: DataSource,
    private readonly nombaProvider: NombaProvider,
    private readonly payrollPayoutService: PayrollPayoutService,
  ) {}
  async processMultiPaymentPayroll(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
  ): Promise<BatchPaymentResult> {
    if (!isPayrollGatewayEnabled()) {
      throw new BadRequestException(
        'Nomba payroll gateway is not configured. Use manual disburse or configure Nomba credentials.',
      );
    }
    const payrollRun = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items', 'items.employee', 'tenant'],
    });
    if (!payrollRun) {
      throw new NotFoundException('Payroll run not found');
    }
    if (payrollRun.status !== PayrollStatus.APPROVED && payrollRun.status !== PayrollStatus.PROCESSING) {
      throw new BadRequestException(
        `Payroll run must be approved before payout. Current: ${payrollRun.status}`,
      );
    }
    const paymentBatch = await this.categorizePayments(
      payrollRun.items,
      tenantId,
      payrollRun.baseCurrency,
    );
    this.logger.log(`Processing payment batch: ${paymentBatch.fiatPayments.length} bank payments`);
    const fiatPaymentResults = await this.processFiatPayments(
      paymentBatch.fiatPayments,
      auditContext,
      tenantId,
      payrollRun.tenant?.name,
    );
    const summary = this.calculatePaymentSummary(fiatPaymentResults);
    await this.payrollPayoutService.reconcilePayrollRunStatus(payrollRunId);
    const result: BatchPaymentResult = {
      totalItems: payrollRun.items.length,
      successfulPayments: summary.fiatSuccess,
      failedPayments: summary.fiatFailed,
      fiatResults: fiatPaymentResults,
      summary,
    };
    return result;
  }
  async retryFailedPayments(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
    specificItemIds?: string[],
  ): Promise<BatchPaymentResult> {
    if (!isPayrollGatewayEnabled()) {
      throw new BadRequestException(
        'Nomba payroll gateway is not configured.',
      );
    }
    const payrollRun = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items', 'items.employee', 'tenant'],
    });
    if (!payrollRun) {
      throw new NotFoundException('Payroll run not found');
    }
    let failedItems = payrollRun.items.filter((item) => item.status === PayrollItemStatus.FAILED);
    if (specificItemIds && specificItemIds.length > 0) {
      failedItems = failedItems.filter((item) => specificItemIds.includes(item.id));
    }
    if (failedItems.length === 0) {
      throw new BadRequestException('No failed payments found to retry');
    }
    this.logger.log(
      `Retrying ${failedItems.length} failed payments for payroll run ${payrollRunId}`,
    );
    await this.resetItemsForRetry(failedItems);
    const paymentBatch = await this.categorizePayments(
      failedItems,
      tenantId,
      payrollRun.baseCurrency,
    );
    const fiatPaymentResults = await this.processFiatPayments(
      paymentBatch.fiatPayments,
      auditContext,
      tenantId,
      payrollRun.tenant?.name,
    );
    const summary = this.calculatePaymentSummary(fiatPaymentResults);
    await this.payrollPayoutService.reconcilePayrollRunStatus(payrollRunId);
    const remainingFailedCount = await this.payrollItemRepository.count({
      where: { payrollRunId, status: PayrollItemStatus.FAILED },
    });
    if (remainingFailedCount === 0) {
      await this.payrollPayoutService.reconcilePayrollRunStatus(payrollRunId);
    }
    const result: BatchPaymentResult = {
      totalItems: failedItems.length,
      successfulPayments: summary.fiatSuccess,
      failedPayments: summary.fiatFailed,
      fiatResults: fiatPaymentResults,
      summary,
    };
    return result;
  }
  async getPaymentStatusSummary(payrollRunId: string, tenantId: string) {
    const items = await this.payrollItemRepository.findByPayrollRunId(payrollRunId);
    const statusCounts = items.reduce(
      (acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      },
      {} as Record<PayrollItemStatus, number>,
    );
    const paymentTypeCounts = await this.getPaymentTypeBreakdown(items);
    return {
      total: items.length,
      statusBreakdown: statusCounts,
      paymentTypeBreakdown: paymentTypeCounts,
      canRetry: statusCounts[PayrollItemStatus.FAILED] > 0,
      isComplete:
        statusCounts[PayrollItemStatus.FAILED] === 0 &&
        statusCounts[PayrollItemStatus.PENDING] === 0,
    };
  }
  private async categorizePayments(
    items: PayrollItem[],
    tenantId: string,
    currency: string,
  ): Promise<PaymentBatch> {
    const fiatPayments: PayrollItem[] = [];
    const skipped: PayrollItem[] = [];

    for (const item of items) {
      if (item.status === PayrollItemStatus.CANCELLED) {
        continue;
      }

      const readiness = await this.paymentMethodService.assessPayrollReadiness(
        tenantId,
        item.memberId,
        currency,
        Boolean(item.metadata?.excludedFromRun),
      );
      if (!readiness.ready) {
        skipped.push(item);
        await this.payrollItemRepository.update(item.id, {
          status: PayrollItemStatus.FAILED,
          failureReason: readiness.message,
        });
        continue;
      }

      fiatPayments.push(item);
    }

    if (skipped.length > 0) {
      this.logger.warn(
        `Skipped ${skipped.length} payroll item(s) without complete payment settings`,
      );
    }

    return { fiatPayments };
  }
  private async processFiatPayments(
    items: PayrollItem[],
    auditContext: AuditContext,
    tenantId: string,
    tenantName?: string,
  ): Promise<PaymentResult[]> {
    const results: PaymentResult[] = [];
    for (const item of items) {
      try {
        await this.payrollItemRepository.update(item.id, {
          status: PayrollItemStatus.PROCESSING,
        });
        const readiness = await this.paymentMethodService.assessPayrollReadiness(
          tenantId,
          item.memberId,
          item.paymentCurrency,
          Boolean(item.metadata?.excludedFromRun),
        );
        if (!readiness.ready || !readiness.paymentMethodId) {
          throw new BadRequestException(readiness.message);
        }

        const paymentMethod = await this.paymentMethodService.findById(readiness.paymentMethodId);
        if (!paymentMethod) {
          throw new BadRequestException('Payment method not found');
        }

        const provider = this.nombaProvider;
        const employeeName = item.employee
          ? `${item.employee.firstName ?? ''} ${item.employee.lastName ?? ''}`.trim()
          : item.memberId;
        const paymentData = buildPayrollPaymentData(item, paymentMethod, employeeName, tenantName);
        const result = await provider.createPayment(paymentData);
        if (result.success) {
          await this.paymentMethodService.recordPaymentMethodUsage(paymentMethod.id);
          const outcome = this.payrollPayoutService.classifyPaymentResultStatus(
            result.providerStatus,
          );
          const itemStatus =
            outcome === 'paid'
              ? PayrollItemStatus.PAID
              : outcome === 'failed'
                ? PayrollItemStatus.FAILED
                : PayrollItemStatus.PROCESSING;

          await this.payrollItemRepository.update(item.id, {
            status: itemStatus,
            transactionId: result.transactionId,
            paymentProvider: 'Nomba',
            paymentMethodId: paymentMethod.id,
            paidAt: itemStatus === PayrollItemStatus.PAID ? new Date() : null,
            failureReason:
              itemStatus === PayrollItemStatus.FAILED
                ? result.error || 'Nomba transfer failed'
                : null,
          });
          results.push({
            success: itemStatus === PayrollItemStatus.PAID,
            transactionId: result.transactionId,
            provider: 'Nomba',
            error: itemStatus === PayrollItemStatus.FAILED ? result.error : undefined,
          });
        } else {
          throw new BadRequestException(result.error || 'Payment failed');
        }
      } catch (error) {
        await this.payrollItemRepository.update(item.id, {
          status: PayrollItemStatus.FAILED,
          failureReason: error.message,
        });
        results.push({
          success: false,
          error: error.message,
        });
      }
    }
    return results;
  }
  private calculatePaymentSummary(fiatResults: PaymentResult[]): PaymentSummary {
    return {
      fiatSuccess: fiatResults.filter((r) => r.success).length,
      fiatFailed: fiatResults.filter((r) => !r.success && r.error).length,
    };
  }
  private async resetItemsForRetry(items: PayrollItem[]): Promise<void> {
    for (const item of items) {
      await this.payrollItemRepository.update(item.id, {
        status: PayrollItemStatus.PENDING,
        failureReason: null,
        transactionId: null,
        paymentProvider: null,
        paidAt: null,
      });
    }
  }
  private async getPaymentTypeBreakdown(items: PayrollItem[]) {
    const breakdown = {
      fiat: { total: 0, paid: 0, failed: 0, pending: 0 },
    };
    for (const item of items) {
      breakdown.fiat.total++;
      switch (item.status) {
        case PayrollItemStatus.PAID:
          breakdown.fiat.paid++;
          break;
        case PayrollItemStatus.FAILED:
          breakdown.fiat.failed++;
          break;
        case PayrollItemStatus.PENDING:
        case PayrollItemStatus.PROCESSING:
          breakdown.fiat.pending++;
          break;
      }
    }
    return breakdown;
  }
}
