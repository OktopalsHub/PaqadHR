import { BadRequestException, Logger } from '@nestjs/common';
import { isCryptoCurrency } from 'src/common/constants/crypto-currencies.constant';
import type { AuditContext } from 'src/common/interfaces/audit-context.interface';
import { PaymentProviderFactoryService } from 'src/common/services/payment-provider-factory.service';
import {
  paymentProviderLabel,
  resolvePaymentProvider,
} from 'src/common/utils/resolve-payment-provider.util';
import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import type { PaymentBatch } from '../../../../common/interfaces/payment-batch.interface';
import type { PaymentResult } from '../../../../common/interfaces/payment-result.interface';
import { PaymentMethodService } from '../../payment-method/services/payment-method.service';
import { PAYROLL_SECURITY_CONFIG } from '../config/security.config';
import type { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { buildPayrollPaymentData } from '../utils/payroll-payment.util';
import { PayrollPayoutService } from './payroll-payout.service';

export class PaymentBatching {
  private readonly logger = new Logger(PaymentBatching.name);
  constructor(
    private readonly payrollItemRepository: PayrollItemRepository,
    private readonly paymentMethodService: PaymentMethodService,
    private readonly paymentProviderFactory: PaymentProviderFactoryService,
    private readonly payrollPayoutService: PayrollPayoutService,
  ) {}

  async categorizePayments(
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

  async claimItemsForPayout(itemIds: string[]): Promise<Set<string>> {
    if (itemIds.length === 0) {
      return new Set();
    }
    const result = await this.payrollItemRepository
      .createQueryBuilder()
      .update()
      .set({ status: PayrollItemStatus.PROCESSING })
      .where('id IN (:...ids)', { ids: itemIds })
      .andWhere('status = :pending', { pending: PayrollItemStatus.PENDING })
      .returning('id')
      .execute();
    const rows = result.raw as Array<{ id: string }>;
    return new Set(rows.map((row) => row.id));
  }

  async processPayouts(
    items: PayrollItem[],
    _auditContext: AuditContext,
    tenantId: string,
    tenantName?: string,
    payrollRunTitle?: string,
  ): Promise<PaymentResult[]> {
    const results: PaymentResult[] = [];
    const claimedIds = await this.claimItemsForPayout(items.map((item) => item.id));

    for (const item of items) {
      const rail: 'bank' | 'crypto' = isCryptoCurrency(item.paymentCurrency) ? 'crypto' : 'bank';
      if (!claimedIds.has(item.id)) {
        results.push({
          success: false,
          error: 'Item already claimed or not pending',
          rail,
        });
        continue;
      }
      try {
        if (
          !item.paymentAmount ||
          item.paymentAmount < PAYROLL_SECURITY_CONFIG.MIN_PAYMENT_AMOUNT
        ) {
          throw new BadRequestException(
            `Invalid payment amount: ${item.paymentAmount} for employee ${item.memberId}`,
          );
        }
        if (item.paymentAmount > PAYROLL_SECURITY_CONFIG.MAX_PAYMENT_LIMIT) {
          throw new BadRequestException(
            `Payment amount exceeds maximum limit of ${PAYROLL_SECURITY_CONFIG.MAX_PAYMENT_LIMIT} for employee ${item.memberId}`,
          );
        }

        const readiness = await this.paymentMethodService.assessPayrollReadiness(
          tenantId,
          item.memberId,
          item.paymentCurrency,
          Boolean(item.metadata?.excludedFromRun),
        );
        if (!readiness.ready || !readiness.paymentMethodId) {
          throw new BadRequestException(readiness.message);
        }

        const paymentMethod = await this.paymentMethodService.findById(
          readiness.paymentMethodId,
          tenantId,
        );
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
        } else if (result.retryable) {
          await this.payrollItemRepository.update(item.id, {
            status: PayrollItemStatus.PROCESSING,
            transactionId: result.transactionId ?? null,
            paymentProvider: providerName,
            paymentMethodId: paymentMethod.id,
            failureReason: result.error || `${providerName} payout pending verification`,
          });
          results.push({
            success: false,
            transactionId: result.transactionId,
            provider: providerName,
            error: result.error,
            rail,
          });
        } else {
          throw new BadRequestException(result.error || 'Payment failed');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const lower = message.toLowerCase();
        const retryable =
          lower.includes('fincra payout status lookup failed') ||
          lower.includes('abort') ||
          lower.includes('timeout');
        if (retryable) {
          await this.payrollItemRepository.update(item.id, {
            status: PayrollItemStatus.PROCESSING,
            failureReason: message,
          });
        } else {
          await this.payrollItemRepository.update(item.id, {
            status: PayrollItemStatus.FAILED,
            failureReason: message,
          });
        }
        results.push({
          success: false,
          error: message,
          rail,
        });
      }
    }
    return results;
  }
}
