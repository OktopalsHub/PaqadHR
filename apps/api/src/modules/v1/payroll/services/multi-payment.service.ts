import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import {
  type BachsFundingItem,
  quoteSourceAmountForDestination,
  resolveBachsQuoteDestinationCurrency,
  sourceAmountForBachsFundingItem,
} from 'src/common/config/bachs-funding-quote.util';
import { getPayrollPayoutFeePerTransfer } from 'src/common/config/payroll-payout-fee.util';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import type { AuditContext } from 'src/common/interfaces/audit-context.interface';
import { BachsApiService } from 'src/common/services/bachs-api.service';
import { PaymentProviderFactoryService } from 'src/common/services/payment-provider-factory.service';
import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { PayrollStatus } from '../../../../common/enums/payroll-status.enum';
import type { BatchPaymentResult } from '../../../../common/interfaces/batch-payment-result.interface';
import { PaymentMethodService } from '../../payment-method/services/payment-method.service';
import { isPayrollGatewayEnabled } from '../config/payroll-disbursement.config';
import type { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollFundingLedgerEventType } from '../entities/payroll-run-funding-ledger-entry.entity';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { resolvePayrollPayoutAmount } from '../utils/payroll-payment.util';
import { PaymentBatching } from './payment-batching';
import { PaymentValidation } from './payment-validation';
import { PayrollLifecycleNotifyService } from './payroll-lifecycle-notify.service';
import { PayrollPayoutService } from './payroll-payout.service';
import { PayrollRunFundingLedgerService } from './payroll-run-funding-ledger.service';

const PAYROLL_PROCESSING_LOCK_MS = 30 * 60 * 1000;

/** Bachs float top-up funding currency only — never stamp Nomba/Monnify NGN onto Bachs items. */
function bachsFundingCurrencyFromFloatTopup(floatTopup: unknown): string | undefined {
  if (!floatTopup || typeof floatTopup !== 'object') return undefined;
  const meta = floatTopup as { provider?: unknown; fundingCurrency?: unknown };
  if (meta.provider !== PaymentProvider.BACHS) return undefined;
  return typeof meta.fundingCurrency === 'string' ? meta.fundingCurrency : undefined;
}

function isBachsBackedRun(
  run: { metadata?: Record<string, unknown> | null },
  items: PayrollItem[],
): boolean {
  const floatTopup = run.metadata?.floatTopup;
  const retryFunding = run.metadata?.retryFunding;
  if (
    (floatTopup &&
      typeof floatTopup === 'object' &&
      'provider' in floatTopup &&
      floatTopup.provider === PaymentProvider.BACHS) ||
    (retryFunding &&
      typeof retryFunding === 'object' &&
      'provider' in retryFunding &&
      retryFunding.provider === PaymentProvider.BACHS)
  ) {
    return true;
  }
  return items.some((item) => (item.paymentProvider ?? '').toLowerCase().includes('bachs'));
}

/**
 * Why a payout found nothing to send. A run whose items are already paid, in flight, or
 * cancelled is not a payment-method or funding problem, so it must not be reported as one.
 */
export function noPayableEmployeesMessage(items: PayrollItem[], suffix: string): string {
  const active = items.filter((item) => item.status !== PayrollItemStatus.CANCELLED);
  const settled = active.filter(
    (item) =>
      item.status === PayrollItemStatus.PAID || item.status === PayrollItemStatus.PROCESSING,
  );

  if (active.length === 0) {
    return 'Every employee on this run was cancelled, so there is nothing to pay.';
  }
  if (settled.length === active.length) {
    const allPaid = active.every((item) => item.status === PayrollItemStatus.PAID);
    return allPaid
      ? 'Every employee on this run has already been paid.'
      : 'Payment for this run is already in progress. It updates when each payout completes — no need to pay again.';
  }

  return `No employees could be paid. Check each employee payment method and that your payout provider account is funded, ${suffix}`;
}

@Injectable()
export class MultiPaymentService {
  private readonly batching: PaymentBatching;
  private readonly validation: PaymentValidation;
  private readonly lifecycleNotify?: PayrollLifecycleNotifyService;
  constructor(
    private readonly payrollRunRepository: PayrollRunRepository,
    private readonly payrollItemRepository: PayrollItemRepository,
    readonly paymentMethodService: PaymentMethodService,
    readonly paymentProviderFactory: PaymentProviderFactoryService,
    private readonly payrollPayoutService: PayrollPayoutService,
    @Optional() lifecycleNotify?: PayrollLifecycleNotifyService,
    @Optional() private readonly fundingLedger?: PayrollRunFundingLedgerService,
    @Optional() private readonly bachsApi?: BachsApiService,
  ) {
    this.lifecycleNotify = lifecycleNotify;
    this.validation = new PaymentValidation(payrollItemRepository);
    this.batching = new PaymentBatching(
      payrollItemRepository,
      paymentMethodService,
      paymentProviderFactory,
      payrollPayoutService,
      lifecycleNotify,
    );
  }
  async processMultiPaymentPayroll(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
  ): Promise<BatchPaymentResult> {
    if (!isPayrollGatewayEnabled()) {
      throw new BadRequestException(
        'Payroll gateway is not configured. Use manual disburse or configure Nomba/Monnify/Fincra (NGN) and/or Noah/Fincra credentials.',
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
    if (
      payrollRun.items.some((item) => item.status === PayrollItemStatus.FAILED) &&
      isBachsBackedRun(payrollRun, payrollRun.items)
    ) {
      throw new BadRequestException(
        'Bachs failed payouts must use the guarded retry flow. Reprocessing the whole run is blocked until retry funding and reservations are reconciled.',
      );
    }

    const lockAt = new Date();
    if (!(await this.claimPayrollRun(payrollRunId, tenantId, auditContext, lockAt))) {
      throw new BadRequestException('Payroll run is already being processed');
    }

    try {
      if (payrollRun.payoutMode === 'scheduled' && this.lifecycleNotify) {
        await this.lifecycleNotify.onScheduledPayoutDue({
          tenantId,
          run: {
            id: payrollRun.id,
            title: payrollRun.title,
            tenantId,
            periodStart: payrollRun.periodStart,
            periodEnd: payrollRun.periodEnd,
            paymentDate: payrollRun.paymentDate,
          },
        });
      }
      if (payrollRun.payoutMode === 'scheduled') {
        payrollRun.payoutMode = 'immediate';
        await this.payrollRunRepository.save(payrollRun);
      }
      const paymentBatch = await this.batching.categorizePayments(payrollRun.items, tenantId);
      const payable = [...paymentBatch.bankPayments, ...paymentBatch.cryptoPayments];
      if (payable.length === 0) {
        await this.payrollPayoutService.reconcilePayrollRunStatus(payrollRunId, tenantId);
        throw new BadRequestException(
          noPayableEmployeesMessage(payrollRun.items, 'then use Retry payment.'),
        );
      }
      const payoutResults = await this.batching.processPayouts(
        payable,
        auditContext,
        tenantId,
        payrollRun.tenant?.name,
        payrollRun.title,
        {
          periodStart: payrollRun.periodStart,
          periodEnd: payrollRun.periodEnd,
          baseCurrency: payrollRun.baseCurrency,
          bachsSourceCurrency: bachsFundingCurrencyFromFloatTopup(payrollRun.metadata?.floatTopup),
        },
      );
      const summary = this.validation.calculatePaymentSummary(payoutResults);
      await this.payrollPayoutService.reconcilePayrollRunStatus(payrollRunId, tenantId);
      return {
        totalItems: payrollRun.items.length,
        successfulPayments: summary.bankSuccess + summary.cryptoSuccess,
        failedPayments: summary.bankFailed + summary.cryptoFailed,
        processingPayments: summary.bankProcessing + summary.cryptoProcessing,
        fiatResults: payoutResults,
        payoutResults,
        summary,
      };
    } finally {
      await this.releasePayrollRun(payrollRunId, tenantId, lockAt);
    }
  }

  async retryFailedPayments(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
    specificItemIds?: string[],
  ): Promise<BatchPaymentResult> {
    if (!isPayrollGatewayEnabled()) {
      throw new BadRequestException(
        'Payroll gateway is not configured. Configure Nomba/Monnify/Fincra (NGN) and/or Noah/Fincra credentials.',
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
    const isBachsRetry = isBachsBackedRun(payrollRun, failedItems);
    if (isBachsRetry) {
      await this.assertBachsRetryFundingAuthorized(payrollRun, failedItems, tenantId);
    }

    const lockAt = new Date();
    if (!(await this.claimPayrollRun(payrollRunId, tenantId, auditContext, lockAt))) {
      throw new BadRequestException('Payroll run is already being processed');
    }

    try {
      const retriableItems: PayrollItem[] = [];
      for (const item of failedItems) {
        const canRetry = await this.payrollPayoutService.reconcileFailedItemBeforeRetry(
          item,
          tenantId,
        );
        if (canRetry) {
          retriableItems.push(item);
        }
      }
      if (retriableItems.length === 0) {
        throw new BadRequestException('No failed payments found to retry');
      }
      if (isBachsRetry) {
        const meta = payrollRun.metadata?.retryFunding as {
          orderReference: string;
          currency: string;
          approvedById: string;
          itemFundingAmounts: Record<string, number>;
        };
        if (!this.fundingLedger) {
          throw new BadRequestException(
            'Run-scoped funding ledger is unavailable; retry remains blocked',
          );
        }
        await this.assertRetryQuotesCovered(payrollRun, retriableItems, meta);
        const reservations = retriableItems.map((item) => {
          const amount = Number(meta.itemFundingAmounts[item.id]);
          if (!Number.isFinite(amount) || amount <= 0) {
            throw new BadRequestException(
              `Missing approved funding allocation for failed payroll item ${item.id}`,
            );
          }
          return {
            payrollItemId: item.id,
            amount,
            currency: meta.currency,
            reservationKey: `${meta.orderReference}:${item.id}`,
          };
        });
        await this.fundingLedger.reserveFailedPayoutsForRetry({
          tenantId,
          payrollRunId,
          provider: PaymentProvider.BACHS,
          performedById: auditContext.performedById ?? meta.approvedById,
          evidence: {
            fundingReference: meta.orderReference,
            approvedById: meta.approvedById,
            retryFundingPurpose: 'company_funded_retry_shortfall',
          },
          reservations,
        });
        for (const item of retriableItems) {
          const priorRetry =
            typeof item.metadata?.payoutRetryCount === 'number' ? item.metadata.payoutRetryCount : 0;
          item.status = PayrollItemStatus.PENDING;
          item.failureReason = null;
          item.transactionId = null;
          item.paymentProvider = null;
          item.paidAt = null;
          item.metadata = { ...(item.metadata ?? {}), payoutRetryCount: priorRetry + 1 };
        }
      } else {
        await this.validation.resetItemsForRetry(retriableItems, tenantId);
      }
      const paymentBatch = await this.batching.categorizePayments(retriableItems, tenantId);
      const payable = [...paymentBatch.bankPayments, ...paymentBatch.cryptoPayments];
      if (isBachsRetry && this.fundingLedger) {
        const payableIds = new Set(payable.map((item) => item.id));
        const meta = payrollRun.metadata?.retryFunding as {
          orderReference: string;
        };
        for (const item of retriableItems) {
          if (payableIds.has(item.id)) continue;
          await this.fundingLedger.releaseUnsubmittedPayoutReservation({
            tenantId,
            payrollRunId,
            payrollItemId: item.id,
            reservationKey: `${meta.orderReference}:${item.id}`,
            evidence: {
              validationStage: 'payment_readiness',
              submissionAttempted: false,
              reason: 'item_not_in_payable_batch',
            },
          });
        }
      }
      if (payable.length === 0) {
        await this.payrollPayoutService.reconcilePayrollRunStatus(payrollRunId, tenantId);
        throw new BadRequestException(
          noPayableEmployeesMessage(retriableItems, 'then retry again.'),
        );
      }
      const payoutResults = await this.batching.processPayouts(
        payable,
        auditContext,
        tenantId,
        payrollRun.tenant?.name,
        payrollRun.title,
        {
          periodStart: payrollRun.periodStart,
          periodEnd: payrollRun.periodEnd,
          baseCurrency: payrollRun.baseCurrency,
          bachsSourceCurrency: bachsFundingCurrencyFromFloatTopup(payrollRun.metadata?.floatTopup),
        },
      );
      const summary = this.validation.calculatePaymentSummary(payoutResults);
      await this.payrollPayoutService.reconcilePayrollRunStatus(payrollRunId, tenantId);
      return {
        totalItems: retriableItems.length,
        successfulPayments: summary.bankSuccess + summary.cryptoSuccess,
        failedPayments: summary.bankFailed + summary.cryptoFailed,
        processingPayments: summary.bankProcessing + summary.cryptoProcessing,
        fiatResults: payoutResults,
        payoutResults,
        summary,
      };
    } finally {
      await this.releasePayrollRun(payrollRunId, tenantId, lockAt);
    }
  }

  private async assertRetryQuotesCovered(
    payrollRun: { baseCurrency: string; metadata: Record<string, unknown> | null },
    items: PayrollItem[],
    meta: {
      currency: string;
      itemFundingAmounts: Record<string, number>;
    },
  ): Promise<void> {
    const bachsApi = this.bachsApi;
    if (!bachsApi) {
      throw new BadRequestException(
        'Bachs quote service is unavailable. Retry remains blocked until funding can be revalidated.',
      );
    }
    if (meta.currency !== 'USD' && meta.currency !== 'NGN') {
      throw new BadRequestException(
        'Retry funding currency is invalid; Bachs retry remains blocked.',
      );
    }
    const originalSourceCurrency = bachsFundingCurrencyFromFloatTopup(
      payrollRun.metadata?.floatTopup,
    );
    if (
      originalSourceCurrency &&
      originalSourceCurrency.toUpperCase() !== meta.currency.toUpperCase()
    ) {
      throw new BadRequestException(
        'Retry funding currency does not match the original Bachs payout source currency.',
      );
    }
    for (const item of items) {
      const paymentCurrency = (item.paymentCurrency || payrollRun.baseCurrency).toUpperCase();
      const fxAtPayout = item.metadata?.fxAtPayout === true;
      const fundingItem: BachsFundingItem = {
        amount: resolvePayrollPayoutAmount(item),
        amountCurrency: fxAtPayout
          ? (item.baseSalaryCurrency || payrollRun.baseCurrency).toUpperCase()
          : paymentCurrency,
        paymentCurrency,
        cryptoNetwork:
          typeof item.metadata?.cryptoNetwork === 'string' ? item.metadata.cryptoNetwork : null,
        fxAtPayout,
      };
      if (!Number.isFinite(fundingItem.amount) || fundingItem.amount <= 0) {
        throw new BadRequestException(
          `Invalid payout amount for payroll item ${item.id}; retry remains blocked.`,
        );
      }
      let requiredAmount = await sourceAmountForBachsFundingItem({
        item: fundingItem,
        fundingCurrency: meta.currency as 'USD' | 'NGN',
        createQuote: (input) => bachsApi.createPayoutQuote(input),
      });

      if (fundingItem.paymentCurrency === fundingItem.amountCurrency) {
        const feeAmount = getPayrollPayoutFeePerTransfer(
          fundingItem.paymentCurrency,
          PaymentProvider.BACHS,
        );
        if (feeAmount > 0) {
          if (fundingItem.paymentCurrency === meta.currency.toUpperCase()) {
            requiredAmount += feeAmount;
          } else {
            const destination = resolveBachsQuoteDestinationCurrency(
              fundingItem.paymentCurrency,
              fundingItem.cryptoNetwork,
            );
            if (!destination) {
              throw new BadRequestException(
                `Cannot revalidate the ${fundingItem.paymentCurrency} payout fee for retry funding.`,
              );
            }
            const quotedFee = await quoteSourceAmountForDestination({
              createQuote: (input) => bachsApi.createPayoutQuote(input),
              fromCurrency: meta.currency,
              toCurrency: destination,
              targetToAmount: feeAmount,
              payoutMethod:
                destination.startsWith('USDT_') || destination.startsWith('USDC_')
                  ? undefined
                  : 'BANK_TRANSFER',
            });
            requiredAmount += quotedFee.sourceAmount;
          }
        }
      }

      const allocated = Number(meta.itemFundingAmounts[item.id]);
      if (!Number.isFinite(allocated) || requiredAmount > allocated + 0.01) {
        throw new BadRequestException(
          `Bachs source quote for payroll item ${item.id} now exceeds its approved funding allocation. Approve and fund the updated shortfall before retrying.`,
        );
      }
    }
  }

  private async assertBachsRetryFundingAuthorized(
    payrollRun: { id: string; tenantId: string; metadata: Record<string, unknown> | null },
    failedItems: PayrollItem[],
    tenantId: string,
  ): Promise<void> {
    if (!this.fundingLedger) {
      throw new BadRequestException(
        'Run-scoped funding ledger is unavailable; Bachs retry remains blocked',
      );
    }
    const raw = payrollRun.metadata?.retryFunding;
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException(
        'Approve and fund the selected Bachs retry shortfall before retrying failed payouts.',
      );
    }
    const meta = raw as {
      orderReference?: string;
      status?: string;
      selectedItemIds?: string[];
      amount?: number;
      currency?: string;
      approvedById?: string;
      itemFundingAmounts?: Record<string, number>;
    };
    const selectedIds = [...(meta.selectedItemIds ?? [])].sort();
    const requestedIds = failedItems.map((item) => item.id).sort();
    if (
      meta.status !== 'funded' ||
      !meta.orderReference ||
      !meta.approvedById ||
      !meta.currency ||
      !Number.isFinite(Number(meta.amount)) ||
      Number(meta.amount) <= 0 ||
      selectedIds.length !== requestedIds.length ||
      selectedIds.some((id, index) => id !== requestedIds[index])
    ) {
      throw new BadRequestException(
        'Bachs retry requires completed checkout funding approved for exactly the selected failed payouts.',
      );
    }

    const allocations = meta.itemFundingAmounts ?? {};
    const allocationIds = Object.keys(allocations).sort();
    if (
      allocationIds.length !== selectedIds.length ||
      allocationIds.some((id, index) => id !== selectedIds[index]) ||
      Math.abs(
        Object.values(allocations).reduce((sum, amount) => sum + Number(amount), 0) -
          Number(meta.amount),
      ) > 0.01 ||
      Object.values(allocations).some(
        (amount) => !Number.isFinite(Number(amount)) || Number(amount) <= 0,
      )
    ) {
      throw new BadRequestException(
        'Approved Bachs retry funding allocations are incomplete or inconsistent',
      );
    }

    const ledger = await this.fundingLedger.getRunLedger(tenantId, payrollRun.id);
    const approval = ledger.entries.find(
      (entry) =>
        entry.eventType === PayrollFundingLedgerEventType.SHORTFALL_APPROVED &&
        entry.providerReference === meta.orderReference,
    );
    const funding = ledger.entries.find(
      (entry) =>
        entry.eventType === PayrollFundingLedgerEventType.FUNDING_RECEIVED &&
        entry.providerReference === meta.orderReference,
    );
    const expectedSelectedIds = selectedIds.join(',');
    if (
      !approval ||
      approval.provider !== PaymentProvider.BACHS ||
      approval.approvedById !== meta.approvedById ||
      Number(approval.amount) !== Number(meta.amount) ||
      approval.currency !== meta.currency.toUpperCase() ||
      approval.evidence?.selectedItemIds !== expectedSelectedIds ||
      !funding ||
      funding.provider !== PaymentProvider.BACHS ||
      Number(funding.amount) < Number(meta.amount) ||
      funding.currency !== meta.currency.toUpperCase() ||
      funding.evidence?.fundingPurpose !== 'approved_retry_shortfall' ||
      funding.evidence?.selectedItemIds !== expectedSelectedIds
    ) {
      throw new BadRequestException(
        'Bachs retry funding approval and provider-verified checkout credit do not match. Retry remains blocked.',
      );
    }

    if (
      ledger.entries.some(
        (entry) =>
          entry.eventType === PayrollFundingLedgerEventType.PAYOUT_CONFIRMED &&
          selectedIds.includes(entry.payrollItemId ?? ''),
      )
    ) {
      throw new BadRequestException(
        'A selected payout already has a confirmed provider debit. Reconcile the payout before retrying.',
      );
    }
  }

  private async claimPayrollRun(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
    lockAt: Date,
  ): Promise<boolean> {
    const cutoff = new Date(lockAt.getTime() - PAYROLL_PROCESSING_LOCK_MS);
    const result = await this.payrollRunRepository
      .createQueryBuilder()
      .update()
      .set({
        processingLockedAt: lockAt,
        processingLockedById: auditContext.performedById ?? null,
      })
      .where('id = :payrollRunId', { payrollRunId })
      .andWhere('tenant_id = :tenantId', { tenantId })
      .andWhere('status IN (:...statuses)', {
        statuses: [PayrollStatus.APPROVED, PayrollStatus.PROCESSING],
      })
      .andWhere('(processing_locked_at IS NULL OR processing_locked_at < :cutoff)', { cutoff })
      .execute();

    return (result.affected ?? 0) === 1;
  }

  private async releasePayrollRun(
    payrollRunId: string,
    tenantId: string,
    lockAt: Date,
  ): Promise<void> {
    await this.payrollRunRepository
      .createQueryBuilder()
      .update()
      .set({
        processingLockedAt: null,
        processingLockedById: null,
      })
      .where('id = :payrollRunId', { payrollRunId })
      .andWhere('tenant_id = :tenantId', { tenantId })
      .andWhere('processing_locked_at = :lockAt', { lockAt })
      .execute();
  }

  async getPaymentStatusSummary(payrollRunId: string, tenantId: string) {
    const payrollRun = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      select: ['id'],
    });
    if (!payrollRun) {
      throw new NotFoundException('Payroll run not found');
    }
    const items = await this.payrollItemRepository.findByPayrollRunId(payrollRunId, tenantId);
    const statusCounts = items.reduce(
      (acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      },
      {} as Record<PayrollItemStatus, number>,
    );
    const paymentTypeCounts = await this.validation.getPaymentTypeBreakdown(items);
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
}
