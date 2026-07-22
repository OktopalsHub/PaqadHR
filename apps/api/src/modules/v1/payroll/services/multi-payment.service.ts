import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { isCryptoCurrency } from 'src/common/constants/crypto-currencies.constant';
import type { AuditContext } from 'src/common/interfaces/audit-context.interface';
import { PaymentProviderFactoryService } from 'src/common/services/payment-provider-factory.service';
import {
  paymentProviderLabel,
  resolvePaymentProvider,
} from 'src/common/utils/resolve-payment-provider.util';
import { DataSource } from 'typeorm';
import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { PayrollStatus } from '../../../../common/enums/payroll-status.enum';
import type { BatchPaymentResult } from '../../../../common/interfaces/batch-payment-result.interface';
import type { PaymentBatch } from '../../../../common/interfaces/payment-batch.interface';
import type { PaymentResult } from '../../../../common/interfaces/payment-result.interface';
import { PaymentMethodService } from '../../payment-method/services/payment-method.service';
import { isPayrollGatewayEnabled } from '../config/payroll-disbursement.config';
import type { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { buildPayrollPaymentData } from '../utils/payroll-payment.util';
import { PayrollPayoutService } from './payroll-payout.service';

interface PaymentSummary {
  bankSuccess: number;
  bankFailed: number;
  cryptoSuccess: number;
  cryptoFailed: number;
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
    private readonly paymentProviderFactory: PaymentProviderFactoryService,
    private readonly payrollPayoutService: PayrollPayoutService,
  ) {}
  async processMultiPaymentPayroll(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
  ): Promise<BatchPaymentResult> {
    if (!isPayrollGatewayEnabled()) {
      throw new BadRequestException(
        'Payroll gateway is not configured. Use manual disburse or configure Nomba (NGN) and/or Noah credentials.',
      );
    }
    const payrollRun = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items', 'items.employee', 'tenant'],
    });
    if (!payrollRun) {
      throw new NotFoundException('Payroll run not found');
    }
    if (
      payrollRun.status !== PayrollStatus.APPROVED &&
      payrollRun.status !== PayrollStatus.PROCESSING
    ) {
      throw new BadRequestException(
        `Payroll run must be approved before payout. Current: ${payrollRun.status}`,
      );
    }
    const paymentBatch = await this.categorizePayments(
      payrollRun.items,
      tenantId,
      payrollRun.baseCurrency,
    );
    const payoutResults = await this.processPayouts(
      [...paymentBatch.bankPayments, ...paymentBatch.cryptoPayments],
      auditContext,
      tenantId,
      payrollRun.tenant?.name,
      payrollRun.title,
    );
    const summary = this.calculatePaymentSummary(payoutResults);
    await this.payrollPayoutService.reconcilePayrollRunStatus(payrollRunId);
    return {
      totalItems: payrollRun.items.length,
      successfulPayments: summary.bankSuccess + summary.cryptoSuccess,
      failedPayments: summary.bankFailed + summary.cryptoFailed,
      fiatResults: payoutResults,
      payoutResults,
      summary,
    };
  }
  async retryFailedPayments(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
    specificItemIds?: string[],
  ): Promise<BatchPaymentResult> {
    if (!isPayrollGatewayEnabled()) {
      throw new BadRequestException(
        'Payroll gateway is not configured. Configure Nomba (NGN) and/or Noah credentials.',
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
    await this.resetItemsForRetry(failedItems);
    const paymentBatch = await this.categorizePayments(
      failedItems,
      tenantId,
      payrollRun.baseCurrency,
    );
    const payoutResults = await this.processPayouts(
      [...paymentBatch.bankPayments, ...paymentBatch.cryptoPayments],
      auditContext,
      tenantId,
      payrollRun.tenant?.name,
      payrollRun.title,
    );
    const summary = this.calculatePaymentSummary(payoutResults);
    await this.payrollPayoutService.reconcilePayrollRunStatus(payrollRunId);
    return {
      totalItems: failedItems.length,
      successfulPayments: summary.bankSuccess + summary.cryptoSuccess,
      failedPayments: summary.bankFailed + summary.cryptoFailed,
      fiatResults: payoutResults,
      payoutResults,
      summary,
    };
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
    const bankPayments: PayrollItem[] = [];
    const cryptoPayments: PayrollItem[] = [];
    const skipped: PayrollItem[] = [];
    const runIsCrypto = isCryptoCurrency(currency);

    for (const item of items) {
      if (
        item.status === PayrollItemStatus.CANCELLED ||
        item.status === PayrollItemStatus.PAID ||
        item.status === PayrollItemStatus.PROCESSING ||
        item.status === PayrollItemStatus.FAILED
      ) {
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

      if (runIsCrypto) {
        cryptoPayments.push(item);
      } else {
        bankPayments.push(item);
      }
    }

    if (skipped.length > 0) {
      this.logger.warn(
        `Skipped ${skipped.length} payroll item(s) without complete payment settings`,
      );
    }

    return { bankPayments, cryptoPayments };
  }
  private async processPayouts(
    items: PayrollItem[],
    auditContext: AuditContext,
    tenantId: string,
    tenantName?: string,
    payrollRunTitle?: string,
  ): Promise<PaymentResult[]> {
    const results: PaymentResult[] = [];
    for (const item of items) {
      const rail: 'bank' | 'crypto' = isCryptoCurrency(item.paymentCurrency) ? 'crypto' : 'bank';
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

        const provider = this.paymentProviderFactory.getFiatProvider(
          item.paymentCurrency,
          paymentMethod.type,
        );
        const providerName = paymentProviderLabel(
          resolvePaymentProvider(item.paymentCurrency, paymentMethod.type),
        );
        const employeeName = item.employee
          ? `${item.employee.firstName ?? ''} ${item.employee.lastName ?? ''}`.trim()
          : item.memberId;
        const paymentData = buildPayrollPaymentData(
          item,
          paymentMethod,
          employeeName,
          tenantName,
          payrollRunTitle,
        );
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
            paymentProvider: providerName,
            paymentMethodId: paymentMethod.id,
            paidAt: itemStatus === PayrollItemStatus.PAID ? new Date() : null,
            failureReason:
              itemStatus === PayrollItemStatus.FAILED
                ? result.error || `${providerName} transfer failed`
                : null,
          });
          results.push({
            success: itemStatus === PayrollItemStatus.PAID,
            transactionId: result.transactionId,
            provider: providerName,
            error: itemStatus === PayrollItemStatus.FAILED ? result.error : undefined,
            rail,
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
          rail,
        });
      }
    }
    return results;
  }
  private calculatePaymentSummary(results: PaymentResult[]): PaymentSummary {
    const bank = results.filter((r) => r.rail !== 'crypto');
    const crypto = results.filter((r) => r.rail === 'crypto');
    const bankSuccess = bank.filter((r) => r.success).length;
    const bankFailed = bank.filter((r) => !r.success).length;
    const cryptoSuccess = crypto.filter((r) => r.success).length;
    const cryptoFailed = crypto.filter((r) => !r.success).length;
    return {
      bankSuccess,
      bankFailed,
      cryptoSuccess,
      cryptoFailed,
      fiatSuccess: bankSuccess + cryptoSuccess,
      fiatFailed: bankFailed + cryptoFailed,
    };
  }
  private async resetItemsForRetry(items: PayrollItem[]): Promise<void> {
    for (const item of items) {
      item.status = PayrollItemStatus.PENDING;
      item.failureReason = null;
      item.transactionId = null;
      item.paymentProvider = null;
      item.paidAt = null;
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
      bank: { total: 0, paid: 0, failed: 0, pending: 0 },
      crypto: { total: 0, paid: 0, failed: 0, pending: 0 },
      fiat: { total: 0, paid: 0, failed: 0, pending: 0 },
    };
    for (const item of items) {
      const rail = isCryptoCurrency(item.paymentCurrency) ? 'crypto' : 'bank';
      breakdown[rail].total++;
      breakdown.fiat.total++;
      switch (item.status) {
        case PayrollItemStatus.PAID:
          breakdown[rail].paid++;
          breakdown.fiat.paid++;
          break;
        case PayrollItemStatus.FAILED:
          breakdown[rail].failed++;
          breakdown.fiat.failed++;
          break;
        case PayrollItemStatus.PENDING:
        case PayrollItemStatus.PROCESSING:
          breakdown[rail].pending++;
          breakdown.fiat.pending++;
          break;
      }
    }
    return breakdown;
  }
}
