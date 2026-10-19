import { BadRequestException, Logger } from '@nestjs/common';
import { isCryptoCurrency } from 'src/common/constants/crypto-currencies.constant';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
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
import {
  claimPayrollItemsScoped,
  updatePayrollItemScoped,
} from '../repositories/payroll-item-write.util';
import { buildPayrollPaymentData, resolvePayrollPayoutAmount } from '../utils/payroll-payment.util';
import type { PayrollLifecycleNotifyService } from './payroll-lifecycle-notify.service';
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
  private runNotifyContext: {
    periodStart?: string | Date | null;
    periodEnd?: string | Date | null;
    baseCurrency?: string | null;
  } | null = null;

  constructor(
    private readonly payrollItemRepository: PayrollItemRepository,
    private readonly paymentMethodService: PaymentMethodService,
    private readonly paymentProviderFactory: PaymentProviderFactoryService,
    private readonly payrollPayoutService: PayrollPayoutService,
    private readonly lifecycleNotify?: PayrollLifecycleNotifyService,
  ) {}

  async categorizePayments(items: PayrollItem[], tenantId: string): Promise<PaymentBatch> {
    const bankPayments: PayrollItem[] = [];
    const cryptoPayments: PayrollItem[] = [];
    const skipped: PayrollItem[] = [];

    for (const item of items) {
      if (
        item.status === PayrollItemStatus.CANCELLED ||
        item.status === PayrollItemStatus.PAID ||
        item.status === PayrollItemStatus.PROCESSING ||
        item.status === PayrollItemStatus.FAILED
      ) {
        continue;
      }

      const payoutCurrency = (item.paymentCurrency ?? '').toUpperCase();
      const itemIsCrypto = isCryptoCurrency(payoutCurrency);

      // An item with nothing to pay can never produce a payout, so reject it here — before
      // the claim moves it to PROCESSING. Claiming first would leave a PROCESSING row with
      // no provider payout and no amount, which reconciliation can never resolve.
      if (resolvePayrollPayoutAmount(item) < PAYROLL_SECURITY_CONFIG.MIN_PAYMENT_AMOUNT) {
        skipped.push(item);
        await updatePayrollItemScoped(this.payrollItemRepository, item.id, tenantId, {
          status: PayrollItemStatus.FAILED,
          failureReason:
            `Payroll item has no payable amount (expected at least ${PAYROLL_SECURITY_CONFIG.MIN_PAYMENT_AMOUNT} ${payoutCurrency || ''}`.trim(),
        });
        continue;
      }

      const readiness = await this.paymentMethodService.assessPayrollReadiness(
        tenantId,
        item.memberId,
        Boolean(item.metadata?.excludedFromRun),
        payoutCurrency,
      );
      if (!readiness.ready) {
        skipped.push(item);
        await updatePayrollItemScoped(this.payrollItemRepository, item.id, tenantId, {
          status: PayrollItemStatus.FAILED,
          failureReason: readiness.message,
        });
        continue;
      }

      if (itemIsCrypto) {
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

  async claimItemsForPayout(itemIds: string[], tenantId: string): Promise<Set<string>> {
    const claimed = await claimPayrollItemsScoped(
      this.payrollItemRepository,
      itemIds,
      tenantId,
      PayrollItemStatus.PENDING,
      { status: PayrollItemStatus.PROCESSING },
    );
    return new Set(claimed);
  }

  async processPayouts(
    items: PayrollItem[],
    auditContext: AuditContext,
    tenantId: string,
    tenantName?: string,
    payrollRunTitle?: string,
    runContext?: {
      periodStart?: string | Date | null;
      periodEnd?: string | Date | null;
      baseCurrency?: string | null;
      bachsSourceCurrency?: string | null;
    },
  ): Promise<PaymentResult[]> {
    this.runNotifyContext = runContext ?? null;
    try {
      return await this.executePayouts(
        items,
        auditContext,
        tenantId,
        tenantName,
        payrollRunTitle,
        runContext?.bachsSourceCurrency ?? undefined,
      );
    } finally {
      this.runNotifyContext = null;
    }
  }

  private async executePayouts(
    items: PayrollItem[],
    auditContext: AuditContext,
    tenantId: string,
    tenantName?: string,
    payrollRunTitle?: string,
    bachsSourceCurrency?: string,
  ): Promise<PaymentResult[]> {
    const results: PaymentResult[] = [];
    const claimedIds = await this.claimItemsForPayout(
      items.map((item) => item.id),
      tenantId,
    );
    const prepared: PreparedPayout[] = [];

    for (const item of items) {
      const rail: 'bank' | 'crypto' = isCryptoCurrency(item.paymentCurrency) ? 'crypto' : 'bank';
      if (!claimedIds.has(item.id)) {
        results.push({
          success: false,
          outcome: 'failed',
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
          bachsSourceCurrency,
        );
        prepared.push(preparedItem);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const applied = await this.applyPreparationFailure(
          item,
          message,
          rail,
          tenantId,
          auditContext,
          payrollRunTitle,
        );
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
          results.push(
            await this.applyPreparationFailure(
              entry.item,
              message,
              entry.rail,
              tenantId,
              auditContext,
              payrollRunTitle,
            ),
          );
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
          outcome: 'failed' as const,
          error: 'Missing bulk transfer result for payroll item',
          rail: entry.rail,
          reference: ref,
        };
        results.push(
          await this.applyPayoutResult(entry, result, tenantId, auditContext, payrollRunTitle),
        );
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
    bachsSourceCurrency?: string,
  ): Promise<PreparedPayout> {
    const payoutAmount = resolvePayrollPayoutAmount(item);
    if (payoutAmount < PAYROLL_SECURITY_CONFIG.MIN_PAYMENT_AMOUNT) {
      throw new BadRequestException('Invalid payment amount');
    }
    if (payoutAmount > PAYROLL_SECURITY_CONFIG.MAX_PAYMENT_LIMIT) {
      throw new BadRequestException(
        `Payment amount exceeds maximum limit of ${PAYROLL_SECURITY_CONFIG.MAX_PAYMENT_LIMIT}`,
      );
    }
    // Keep paymentAmount in sync for rows calculated before payout amount was written.
    item.paymentAmount = payoutAmount;

    const readiness = await this.paymentMethodService.assessPayrollReadiness(
      tenantId,
      item.memberId,
      Boolean(item.metadata?.excludedFromRun),
      item.paymentCurrency,
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

    const cryptoNetwork =
      typeof paymentMethod.metadata?.cryptoNetwork === 'string'
        ? paymentMethod.metadata.cryptoNetwork
        : undefined;
    const resolvedProvider = resolvePaymentProvider(
      item.paymentCurrency,
      paymentMethod.type,
      cryptoNetwork,
    );
    const provider = this.paymentProviderFactory.getFiatProvider(
      item.paymentCurrency,
      paymentMethod.type,
      cryptoNetwork,
    );
    const providerName = paymentProviderLabel(resolvedProvider);
    // Provider-side narration/bank details: a raw member UUID must never reach the provider or a
    // bank statement, so fall back to a neutral label rather than the id.
    const employeeName = item.employee
      ? `${item.employee.firstName ?? ''} ${item.employee.lastName ?? ''}`.trim()
      : 'Employee';
    const paymentData = buildPayrollPaymentData(
      item,
      paymentMethod,
      employeeName,
      tenantName,
      payrollRunTitle,
      {
        // Only Bachs items consume float-topup funding currency (never stamp NGN onto USD banks).
        bachsSourceCurrency:
          resolvedProvider === PaymentProvider.BACHS ? bachsSourceCurrency : undefined,
      },
    );

    return { item, paymentData, paymentMethod, provider, providerName, rail };
  }

  private async applyPayoutResult(
    entry: PreparedPayout,
    result: PaymentResult,
    tenantId: string,
    auditContext: AuditContext,
    payrollRunTitle?: string,
  ): Promise<PaymentResult> {
    const { item, paymentMethod, providerName, rail } = entry;
    try {
      if (result.success) {
        await this.paymentMethodService.recordPaymentMethodUsage(paymentMethod.id, tenantId);
        const bachsDestinationId =
          typeof result.metadata?.bachsDestinationId === 'string'
            ? result.metadata.bachsDestinationId
            : undefined;
        if (
          bachsDestinationId &&
          paymentMethod.metadata?.bachsDestinationId !== bachsDestinationId
        ) {
          await this.paymentMethodService.updateProviderMetadata(paymentMethod.id, tenantId, {
            bachsDestinationId,
          });
        }
        const classification = this.payrollPayoutService.classifyPaymentResultStatus(
          result.providerStatus,
        );
        const itemStatus =
          classification === 'paid'
            ? PayrollItemStatus.PAID
            : classification === 'failed'
              ? PayrollItemStatus.FAILED
              : PayrollItemStatus.PROCESSING;

        await updatePayrollItemScoped(this.payrollItemRepository, item.id, tenantId, {
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
        item.status = itemStatus;
        item.transactionId = result.transactionId ?? null;
        item.paymentProvider = providerName;
        item.paidAt = itemStatus === PayrollItemStatus.PAID ? new Date() : null;
        item.failureReason =
          itemStatus === PayrollItemStatus.FAILED
            ? result.error || `${providerName} transfer failed`
            : null;

        if (
          itemStatus === PayrollItemStatus.PAID &&
          providerName.toLowerCase().includes('bachs') &&
          result.transactionId &&
          entry.paymentData.merchantTxRef
        ) {
          await this.payrollPayoutService.recordConfirmedBachsDebit({
            tenantId,
            payrollRunId: item.payrollRunId,
            payrollItemId: item.id,
            transactionId: result.transactionId,
            merchantReference: entry.paymentData.merchantTxRef,
            destinationAmount: result.amount,
          });
        }

        if (this.lifecycleNotify && itemStatus === PayrollItemStatus.PAID) {
          await this.lifecycleNotify.onItemPaid({
            tenantId,
            item,
            run: {
              id: item.payrollRunId,
              title: payrollRunTitle ?? 'Payroll',
              tenantId,
              periodStart: this.runNotifyContext?.periodStart,
              periodEnd: this.runNotifyContext?.periodEnd,
              baseCurrency: this.runNotifyContext?.baseCurrency,
            },
            auditContext,
          });
        }
        if (this.lifecycleNotify && itemStatus === PayrollItemStatus.FAILED) {
          await this.lifecycleNotify.onItemFailed({
            tenantId,
            item,
            run: {
              id: item.payrollRunId,
              title: payrollRunTitle ?? 'Payroll',
              tenantId,
              periodStart: this.runNotifyContext?.periodStart,
              periodEnd: this.runNotifyContext?.periodEnd,
              baseCurrency: this.runNotifyContext?.baseCurrency,
            },
            reason: item.failureReason || 'Payment failed',
            auditContext,
          });
        }

        const outcome =
          itemStatus === PayrollItemStatus.PAID
            ? ('paid' as const)
            : itemStatus === PayrollItemStatus.FAILED
              ? ('failed' as const)
              : ('processing' as const);
        return {
          success: outcome === 'paid',
          outcome,
          transactionId: result.transactionId,
          reference: result.reference ?? entry.paymentData.merchantTxRef,
          provider: providerName,
          providerStatus: result.providerStatus,
          error: outcome === 'failed' ? result.error : undefined,
          rail,
        };
      }

      if (result.retryable) {
        // A retryable failure that still carries the merchant reference means the payout was
        // submitted and we simply never saw the response. Record that, so reconciliation
        // does not mistake it for "never submitted" and fail an item that is already paid.
        const submissionUnknown = !result.transactionId && Boolean(result.reference);
        await updatePayrollItemScoped(this.payrollItemRepository, item.id, tenantId, {
          status: PayrollItemStatus.PROCESSING,
          transactionId: result.transactionId ?? null,
          paymentProvider: providerName,
          paymentMethodId: paymentMethod.id,
          failureReason: result.error || `${providerName} payout pending verification`,
          ...(submissionUnknown
            ? { metadata: { ...(item.metadata ?? {}), payoutSubmissionPending: true } }
            : {}),
        });
        return {
          success: false,
          outcome: 'processing',
          transactionId: result.transactionId,
          reference: result.reference ?? entry.paymentData.merchantTxRef,
          provider: providerName,
          providerStatus: result.providerStatus,
          error: result.error,
          rail,
        };
      }

      throw new BadRequestException(result.error || 'Payment failed');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return this.applyPreparationFailure(
        item,
        message,
        rail,
        tenantId,
        auditContext,
        payrollRunTitle,
      );
    }
  }

  private async applyPreparationFailure(
    item: PayrollItem,
    message: string,
    rail: 'bank' | 'crypto',
    tenantId: string,
    auditContext: AuditContext,
    payrollRunTitle?: string,
  ): Promise<PaymentResult> {
    const lower = message.toLowerCase();
    const retryable =
      lower.includes('fincra payout status lookup failed') ||
      lower.includes('abort') ||
      lower.includes('timeout');
    if (retryable) {
      await updatePayrollItemScoped(this.payrollItemRepository, item.id, tenantId, {
        status: PayrollItemStatus.PROCESSING,
        failureReason: message,
      });
    } else {
      await updatePayrollItemScoped(this.payrollItemRepository, item.id, tenantId, {
        status: PayrollItemStatus.FAILED,
        failureReason: message,
      });
      item.status = PayrollItemStatus.FAILED;
      item.failureReason = message;
      if (this.lifecycleNotify) {
        await this.lifecycleNotify.onItemFailed({
          tenantId,
          item,
          run: {
            id: item.payrollRunId,
            title: payrollRunTitle ?? 'Payroll',
            tenantId,
            periodStart: this.runNotifyContext?.periodStart,
            periodEnd: this.runNotifyContext?.periodEnd,
            baseCurrency: this.runNotifyContext?.baseCurrency,
          },
          reason: message,
          auditContext,
        });
      }
    }
    return {
      success: false,
      outcome: retryable ? 'processing' : 'failed',
      error: message,
      rail,
      retryable,
    };
  }
}
