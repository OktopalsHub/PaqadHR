import { BadRequestException, Logger } from '@nestjs/common';
import { isCryptoCurrency } from 'src/common/constants/crypto-currencies.constant';
import type { AuditContext } from 'src/common/interfaces/audit-context.interface';
import type { CreatePaymentData } from 'src/common/interfaces/create-payment-data.interface';
import type { PaymentProviderInterface } from 'src/common/interfaces/payment-provider-interface.interface';
import { PaymentProviderFactoryService } from 'src/common/services/payment-provider-factory.service';
import {
  paymentProviderLabel,
  resolvePaymentProvider,
} from 'src/common/utils/resolve-payment-provider.util';
import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import type { PaymentBatch } from '../../../../common/interfaces/payment-batch.interface';
import type { PaymentResult } from '../../../../common/interfaces/payment-result.interface';
import type { PaymentMethod } from '../../payment-method/entities/payment-method.entity';
import { PaymentMethodService } from '../../payment-method/services/payment-method.service';
import { PAYROLL_SECURITY_CONFIG } from '../config/security.config';
import type { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { buildPayrollPaymentData } from '../utils/payroll-payment.util';
import { PayrollPayoutService } from './payroll-payout.service';

type PreparedPayout = {
  item: PayrollItem;
  paymentData: CreatePaymentData;
  paymentMethod: PaymentMethod;
  provider: PaymentProviderInterface;
  providerName: string;
  rail: 'bank' | 'crypto';
};

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
    const prepared: PreparedPayout[] = [];

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
        const preparedItem = await this.preparePayoutItem(
          item,
          tenantId,
          tenantName,
          payrollRunTitle,
          rail,
        );
        prepared.push(preparedItem);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const applied = await this.applyPreparationFailure(item, message, rail);
        results.push(applied);
      }
    }

    const groups = new Map<PaymentProviderInterface, PreparedPayout[]>();
    for (const entry of prepared) {
      const list = groups.get(entry.provider) ?? [];
      list.push(entry);
      groups.set(entry.provider, list);
    }

    for (const [provider, group] of groups) {
      const payloads = group.map((entry) => entry.paymentData);
      let bulkResults: PaymentResult[];
      try {
        bulkResults = await provider.createBulkTransfer(payloads);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        for (const entry of group) {
          results.push(await this.applyPreparationFailure(entry.item, message, entry.rail));
        }
        continue;
      }

      const byRef = new Map<string, PaymentResult>();
      for (const result of bulkResults) {
        const key = result.reference ?? result.transactionId;
        if (key && !byRef.has(key)) byRef.set(key, result);
      }

      for (const entry of group) {
        const ref = entry.paymentData.merchantTxRef;
        const matched = ref ? byRef.get(ref) : undefined;
        if (matched && ref) {
          byRef.delete(ref);
        }
        const result = matched ?? {
          success: false,
          error: 'Missing bulk transfer result for payroll item',
          rail: entry.rail,
          reference: ref,
        };
        results.push(await this.applyPayoutResult(entry, result));
      }
    }

    return results;
  }

  private async preparePayoutItem(
    item: PayrollItem,
    tenantId: string,
    tenantName: string | undefined,
    payrollRunTitle: string | undefined,
    rail: 'bank' | 'crypto',
  ): Promise<PreparedPayout> {
    if (!item.paymentAmount || item.paymentAmount < PAYROLL_SECURITY_CONFIG.MIN_PAYMENT_AMOUNT) {
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

    return { item, paymentData, paymentMethod, provider, providerName, rail };
  }

  private async applyPayoutResult(
    entry: PreparedPayout,
    result: PaymentResult,
  ): Promise<PaymentResult> {
    const { item, paymentMethod, providerName, rail } = entry;
    try {
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
        return {
          success: itemStatus === PayrollItemStatus.PAID,
          transactionId: result.transactionId,
          reference: result.reference ?? entry.paymentData.merchantTxRef,
          provider: providerName,
          error: itemStatus === PayrollItemStatus.FAILED ? result.error : undefined,
          rail,
        };
      }

      if (result.retryable) {
        await this.payrollItemRepository.update(item.id, {
          status: PayrollItemStatus.PROCESSING,
          transactionId: result.transactionId ?? null,
          paymentProvider: providerName,
          paymentMethodId: paymentMethod.id,
          failureReason: result.error || `${providerName} payout pending verification`,
        });
        return {
          success: false,
          transactionId: result.transactionId,
          reference: result.reference ?? entry.paymentData.merchantTxRef,
          provider: providerName,
          error: result.error,
          rail,
        };
      }

      throw new BadRequestException(result.error || 'Payment failed');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return this.applyPreparationFailure(item, message, rail);
    }
  }

  private async applyPreparationFailure(
    item: PayrollItem,
    message: string,
    rail: 'bank' | 'crypto',
  ): Promise<PaymentResult> {
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
    return {
      success: false,
      error: message,
      rail,
    };
  }
}
