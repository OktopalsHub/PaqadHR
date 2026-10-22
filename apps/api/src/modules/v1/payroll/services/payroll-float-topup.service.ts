import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  getBachsPayoutSourceCurrency,
  isBachsConfigured,
  isBachsWalletTopupConfigured,
} from 'src/common/config/bachs.config';
import {
  applyPayrollFee,
  type BachsFundingItem,
  pickBachsFundingCurrency,
  sourceAmountWithPayoutFeeForBachsFundingItem,
} from 'src/common/config/bachs-funding-quote.util';
import { calculatePayrollPayoutFeeReserve } from 'src/common/config/payroll-payout-fee.util';
import { isCryptoCurrency } from 'src/common/constants/crypto-currencies.constant';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { PaymentMethodType } from 'src/common/enums/payment-type.enum';
import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';
import { PayrollStatus } from 'src/common/enums/payroll-status.enum';
import type { AuditContext } from 'src/common/interfaces/audit-context.interface';
import { BachsApiService } from 'src/common/services/bachs-api.service';
import { PaymentProviderFactoryService } from 'src/common/services/payment-provider-factory.service';
import { resolvePaymentProvider } from 'src/common/utils/resolve-payment-provider.util';
import { tenantFrontendUrl } from 'src/common/utils/tenant-frontend-url.util';
import { Repository } from 'typeorm';
import { resolveCheckoutCustomerFullName } from '../../rewards/utils/checkout-customer-name.util';
import { BILLING_AMOUNT_TOLERANCE } from '../../subscriptions/constants/billing.constants';
import { normalizeWebhookAmount } from '../../subscriptions/utils/per-seat-pricing.util';
import { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { isPayrollGatewayEnabled } from '../config/payroll-disbursement.config';
import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollRun } from '../entities/payroll-run.entity';
import {
  PayrollFundingLedgerEventType,
  PayrollRunFundingLedgerEntry,
} from '../entities/payroll-run-funding-ledger-entry.entity';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import {
  buildPayrollFloatOrderRef,
  type PayrollFloatOrderRefProvider,
} from '../utils/payroll-float-order-ref.util';
import { buildPayrollMerchantRef } from '../utils/payroll-merchant-ref.util';
import { resolvePayrollPayoutAmount } from '../utils/payroll-payment.util';
import { hasActivePayrollProcessingLock } from '../utils/payroll-processing-lock.util';
import { PayrollFeeService } from './payroll-fee.service';
import { PayrollFloatBalanceService } from './payroll-float-balance.service';
import { PayrollPaymentOrchestrator } from './payroll-payment-orchestrator';
import { PayrollPayoutService } from './payroll-payout.service';
import { PayrollRunFundingLedgerService } from './payroll-run-funding-ledger.service';

const SUCCESSFUL_CHECKOUT_STATUSES = new Set(['success', 'successful', 'succeeded', 'accepted']);

/**
 * How long an open retry funding approval or checkout may stay pending before it is treated as
 * abandoned and cancelled. Without this window an abandoned checkout wedges the run: no new
 * approval can be made, and every retry is refused until the user pays a checkout they no
 * longer want.
 */
export const RETRY_FUNDING_PENDING_TTL_MS = 60 * 60 * 1000;

export type PayrollFundPreflight = {
  ok: boolean;
  provider: PaymentProvider;
  currency: string;
  requiredAmount: number;
  availableBalance: number | null;
  shortfall: number;
  balanceSupported: boolean;
  canCheckout: boolean;
  dashboardUrl: string;
  message: string;
  /** Employee payout total in funding currency (before Paqad fee). */
  employeeTotal?: number;
  platformFee?: number;
  feePercentage?: number;
  /** Additional provider payout-fee reserve, separate from the PaqadHR platform fee. */
  payoutFeeReserve?: number;
  payoutFeePerTransfer?: number;
  payoutTransferCount?: number;
};

type FloatTopupMeta = {
  orderReference?: string;
  status?: 'pending' | 'completed';
  completedAt?: string;
  shortfall?: number;
  provider?: string;
  /** Balance currency the company funded (drives Bachs payout source quotes). */
  fundingCurrency?: string;
};

/** Outcome of verifying a run-scoped retry funding checkout against the provider. */
type RetryFundingVerification =
  | { outcome: 'funded'; orderReference: string; amount: number; currency: string }
  | { outcome: 'pending'; orderReference: string; reason: string }
  | { outcome: 'not_pending' };

export type RetryFundingReconcileStatus = {
  status: 'funded' | 'pending' | 'unavailable';
  orderReference?: string;
  amount?: number;
  currency?: string;
  reason?: string;
};

/**
 * Outcome of a retry funding cancellation.
 *
 * `funded` means the checkout had actually been paid, so it was credited to the run instead of
 * being cancelled. `cancelled` means the open approval or unpaid checkout was released and the
 * run can be funded again. `not_pending` means the run moved on before the cancel landed.
 */
export type RetryFundingCancelStatus = {
  status: 'cancelled' | 'funded' | 'not_pending';
  orderReference?: string;
  amount?: number;
  currency?: string;
  reason?: string;
};

type RetryFundingMeta = {
  orderReference?: string;
  status?: 'approved' | 'pending' | 'funded' | 'cancelled';
  selectedItemIds?: string[];
  /** Total run-scoped funding the failed payouts need (employee pay + provider reserves). */
  amount?: number;
  /** Portion of `amount` the company pays at checkout (total minus the provider balance used). */
  checkoutAmount?: number;
  /** Portion of `amount` already held in the provider float and credited to this run. */
  balanceApplied?: number;
  /** Provider balance snapshot the checkout (or balance credit) was sized against. */
  availableBalance?: number;
  currency?: string;
  provider?: string;
  approvedById?: string;
  approvedAt?: string;
  payoutFeeReserve?: number;
  checkoutUrl?: string;
  /** When the provider checkout creation started, so a wedged "pending" can be retried. */
  checkoutRequestedAt?: string;
  lastCheckoutError?: string;
  lastCheckoutErrorAt?: string;
  fundedAt?: string;
  itemFundingAmounts?: Record<string, number>;
  /** Set when an open approval or checkout is cancelled so the run can be funded again. */
  cancelledAt?: string;
  cancelledById?: string | null;
  cancelReason?: string;
  /**
   * Order references of retry funding checkouts this run released. A checkout can still be paid
   * after it was cancelled (the user kept the provider window open), so the references are kept
   * to credit any late payment to this run instead of losing it.
   */
  cancelledOrderReferences?: string[];
};

@Injectable()
export class PayrollFloatTopupService {
  private readonly logger = new Logger(PayrollFloatTopupService.name);

  constructor(
    private readonly payrollRunRepository: PayrollRunRepository,
    private readonly balanceService: PayrollFloatBalanceService,
    private readonly paymentFactory: PaymentProviderFactoryService,
    private readonly paymentOrchestrator: PayrollPaymentOrchestrator,
    private readonly fundingLedger: PayrollRunFundingLedgerService,
    private readonly tenantSettingsService: TenantSettingsService,
    private readonly payrollFeeService: PayrollFeeService,
    private readonly bachsApi: BachsApiService,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly payrollPayoutService: PayrollPayoutService,
  ) {}

  async preflight(
    payrollRunId: string,
    tenantId: string,
    allowProcessingRun = false,
    retryItemIds?: string[],
  ): Promise<PayrollFundPreflight> {
    if (!isPayrollGatewayEnabled()) {
      throw new BadRequestException(
        'Payroll gateway is not configured. Configure Nomba/Monnify/Fincra/Bachs (NGN) and/or Noah/Fincra/Bachs credentials.',
      );
    }

    let run: PayrollRun;
    if (allowProcessingRun) {
      const retryableRun = await this.payrollRunRepository.findOne({
        where: { id: payrollRunId, tenantId },
        relations: ['items'],
      });
      if (!retryableRun) throw new NotFoundException('Payroll run not found');
      if (
        retryableRun.status !== PayrollStatus.APPROVED &&
        retryableRun.status !== PayrollStatus.PROCESSING
      ) {
        throw new BadRequestException(
          `Payroll run must be approved or processing before retry funding checks. Current: ${retryableRun.status}`,
        );
      }
      run = retryableRun;
      run.items = (run.items ?? []).filter(
        (item) =>
          item.status === PayrollItemStatus.FAILED &&
          (!retryItemIds || retryItemIds.includes(item.id)),
      );
    } else {
      run = await this.requireApprovedRun(payrollRunId, tenantId);
    }
    if (
      !allowProcessingRun &&
      run.items.some((item) => item.status === PayrollItemStatus.FAILED) &&
      ((run.metadata?.floatTopup &&
        typeof run.metadata.floatTopup === 'object' &&
        'provider' in run.metadata.floatTopup &&
        run.metadata.floatTopup.provider === PaymentProvider.BACHS) ||
        (run.metadata?.retryFunding &&
          typeof run.metadata.retryFunding === 'object' &&
          'provider' in run.metadata.retryFunding &&
          run.metadata.retryFunding.provider === PaymentProvider.BACHS) ||
        run.items.some((item) => (item.paymentProvider ?? '').toLowerCase().includes('bachs')))
    ) {
      throw new BadRequestException(
        'This Bachs payroll run has failed payouts. Use the approved, run-scoped retry funding flow instead of funding or paying the whole run again.',
      );
    }

    const bachsPreflight = await this.tryBachsFundingPreflight(run, tenantId, allowProcessingRun);
    if (bachsPreflight) return bachsPreflight;

    const currency = run.baseCurrency.toUpperCase();
    const provider = resolvePaymentProvider(currency);
    const employeeTotal = this.payableNet(run);
    const feePercentage = await this.payrollFeeService.getPayrollFeePercentage(tenantId);
    const platformFee = Math.round(employeeTotal * (feePercentage / 100) * 100) / 100;
    const payoutTransferCount = this.countPayableTransfers(run, currency);
    const payoutFee = calculatePayrollPayoutFeeReserve({
      currency,
      provider,
      transferCount: payoutTransferCount,
    });
    const payoutFeeReserve = payoutFee.total;
    const requiredAmount = Math.round((employeeTotal + platformFee + payoutFeeReserve) * 100) / 100;
    const dashboardUrl = this.balanceService.providerDashboardUrl(provider);
    const canCheckout = this.balanceService.supportsHostedFloatTopup(provider);
    const providerLabel = this.providerDisplayName(provider);

    if (requiredAmount <= 0) {
      return {
        ok: true,
        provider,
        currency,
        requiredAmount: 0,
        availableBalance: null,
        shortfall: 0,
        balanceSupported: false,
        canCheckout: false,
        dashboardUrl,
        message: 'No payable amount on this run.',
        employeeTotal,
        platformFee,
        feePercentage,
        payoutFeeReserve,
        payoutFeePerTransfer: payoutFee.feePerTransfer,
        payoutTransferCount,
      };
    }

    const balance = await this.balanceService.getAvailableBalance(provider, currency);
    if (balance.supported) {
      const shortfall = Math.max(0, Math.round((requiredAmount - balance.available) * 100) / 100);
      if (shortfall <= 0) {
        return {
          ok: true,
          provider,
          currency,
          requiredAmount,
          availableBalance: balance.available,
          shortfall: 0,
          balanceSupported: true,
          canCheckout,
          dashboardUrl,
          message: `${providerLabel} balance already covers this payroll run, including the PaqadHR fee and payout-fee reserve.`,
          employeeTotal,
          platformFee,
          feePercentage,
          payoutFeeReserve,
          payoutFeePerTransfer: payoutFee.feePerTransfer,
          payoutTransferCount,
        };
      }
      return {
        ok: false,
        provider,
        currency,
        requiredAmount,
        availableBalance: balance.available,
        shortfall,
        balanceSupported: true,
        canCheckout,
        dashboardUrl,
        message: canCheckout
          ? `Your company needs to fund ${shortfall} ${currency} via checkout, including the PaqadHR fee and payout-fee reserve. We then pay employees automatically via ${providerLabel}.`
          : `Your company needs to fund ${shortfall} ${currency} in the ${providerLabel} dashboard, including fees, then retry.`,
        employeeTotal,
        platformFee,
        feePercentage,
        payoutFeeReserve,
        payoutFeePerTransfer: payoutFee.feePerTransfer,
        payoutTransferCount,
      };
    }

    // Balance unknown: treat full net as the funding target when checkout exists.
    return {
      ok: false,
      provider,
      currency,
      requiredAmount,
      availableBalance: null,
      shortfall: requiredAmount,
      balanceSupported: false,
      canCheckout,
      dashboardUrl,
      message: canCheckout
        ? `Could not read provider balance. Checkout will fund ${requiredAmount} ${currency}, including the PaqadHR fee and payout-fee reserve, then payout starts automatically.`
        : `${balance.reason} Open ${dashboardUrl || 'the provider dashboard'}, fund at least ${requiredAmount} ${currency}, including fees, then retry.`,
      employeeTotal,
      platformFee,
      feePercentage,
      payoutFeeReserve,
      payoutFeePerTransfer: payoutFee.feePerTransfer,
      payoutTransferCount,
    };
  }

  /**
   * Hosted checkout providers use a one-time checkout for each payroll run. The verified
   * checkout webhook starts immediate payroll payouts; scheduled runs remain funded and wait
   * for the scheduled-payout processor. PaqadHR does not maintain a reusable company wallet.
   */
  async fundAndPay(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
  ): Promise<
    | { action: 'paid'; result: unknown }
    | {
        action: 'checkout';
        checkoutUrl: string;
        orderReference: string;
        preflight: PayrollFundPreflight;
      }
  > {
    const preflight = await this.preflight(payrollRunId, tenantId);

    if (preflight.canCheckout && preflight.requiredAmount > 0) {
      const feeParts = [
        preflight.platformFee != null && preflight.platformFee > 0
          ? `${preflight.platformFee} ${preflight.currency} PaqadHR fee`
          : null,
        preflight.payoutFeeReserve != null && preflight.payoutFeeReserve > 0
          ? `${preflight.payoutFeeReserve} ${preflight.currency} payout-fee reserve`
          : null,
      ].filter((part): part is string => part != null);
      const feeNote = feeParts.length > 0 ? ` (includes ${feeParts.join(' + ')})` : '';
      const checkoutPreflight: PayrollFundPreflight = {
        ...preflight,
        ok: false,
        shortfall: preflight.shortfall,
        message:
          preflight.balanceSupported &&
          preflight.availableBalance != null &&
          preflight.shortfall < preflight.requiredAmount
            ? `Your company pays ${preflight.shortfall} ${preflight.currency}${feeNote} in checkout. Your provider balance covers ${preflight.availableBalance} ${preflight.currency}. We then route each employee's salary via ${this.providerDisplayName(preflight.provider)}.`
            : `Your company pays ${preflight.requiredAmount} ${preflight.currency}${feeNote} in checkout. We then route each employee's salary via ${this.providerDisplayName(preflight.provider)}.`,
      };
      const checkout = await this.createFloatTopupCheckout(
        payrollRunId,
        tenantId,
        auditContext.performedById,
        checkoutPreflight,
      );
      return {
        action: 'checkout',
        checkoutUrl: checkout.checkoutUrl,
        orderReference: checkout.orderReference,
        preflight: checkoutPreflight,
      };
    }

    if (preflight.ok) {
      const run = await this.requireApprovedRun(payrollRunId, tenantId);
      const existing = this.readFloatTopupMeta(run);
      run.metadata = {
        ...run.metadata,
        floatTopup: {
          orderReference: existing.orderReference,
          status: 'completed',
          completedAt: new Date().toISOString(),
          shortfall: 0,
          provider: preflight.provider,
          fundingCurrency: preflight.currency,
        } satisfies FloatTopupMeta,
      };
      await this.payrollRunRepository.save(run);
      const result = await this.paymentOrchestrator.payNowPayroll(
        payrollRunId,
        tenantId,
        auditContext,
      );
      return { action: 'paid', result };
    }

    throw new BadRequestException(preflight.message);
  }

  async fundScheduledPayroll(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
  ): Promise<
    | { action: 'scheduled'; run: PayrollRun }
    | {
        action: 'checkout';
        checkoutUrl: string;
        orderReference: string;
        preflight: PayrollFundPreflight;
      }
  > {
    const run = await this.requireApprovedRun(payrollRunId, tenantId);
    if (run.payoutMode !== 'scheduled') {
      throw new BadRequestException('Payroll run is not configured for scheduled payout');
    }
    if (!run.paymentDate) {
      throw new BadRequestException('Set a payment date before scheduling');
    }

    const existingTopup = this.readFloatTopupMeta(run);
    if (existingTopup.status === 'completed') {
      return { action: 'scheduled', run };
    }
    if (existingTopup.status === 'pending' && existingTopup.orderReference) {
      throw new BadRequestException(
        'Payroll funding checkout is already pending. Complete the existing checkout before scheduling again.',
      );
    }

    const preflight = await this.preflight(payrollRunId, tenantId);
    if (preflight.canCheckout && preflight.requiredAmount > 0) {
      const feeNote =
        preflight.platformFee != null && preflight.platformFee > 0
          ? ` (includes ${preflight.platformFee} ${preflight.currency} Paqad fee)`
          : '';
      const checkoutPreflight: PayrollFundPreflight = {
        ...preflight,
        ok: false,
        shortfall: preflight.shortfall,
        message:
          preflight.balanceSupported &&
          preflight.availableBalance != null &&
          preflight.shortfall < preflight.requiredAmount
            ? `Your company pays ${preflight.shortfall} ${preflight.currency}${feeNote} now. Your provider balance covers ${preflight.availableBalance} ${preflight.currency}. Employees are paid on ${this.toIsoDatePart(run.paymentDate)} via ${this.providerDisplayName(preflight.provider)}.`
            : `Your company pays ${preflight.requiredAmount} ${preflight.currency}${feeNote} now. Employees are paid on ${this.toIsoDatePart(run.paymentDate)} via ${this.providerDisplayName(preflight.provider)}.`,
      };
      const checkout = await this.createFloatTopupCheckout(
        payrollRunId,
        tenantId,
        auditContext.performedById,
        checkoutPreflight,
      );
      return {
        action: 'checkout',
        checkoutUrl: checkout.checkoutUrl,
        orderReference: checkout.orderReference,
        preflight: checkoutPreflight,
      };
    }

    if (!preflight.ok) {
      throw new BadRequestException(preflight.message);
    }

    const existingFloatTopup = run.metadata?.floatTopup;
    const existingOrderReference =
      existingFloatTopup &&
      typeof existingFloatTopup === 'object' &&
      'orderReference' in existingFloatTopup
        ? typeof existingFloatTopup.orderReference === 'string'
          ? existingFloatTopup.orderReference
          : undefined
        : undefined;
    run.metadata = {
      ...run.metadata,
      floatTopup: {
        orderReference: existingOrderReference,
        status: 'completed',
        completedAt: new Date().toISOString(),
        shortfall: 0,
        provider: preflight.provider,
        fundingCurrency: preflight.currency,
      } satisfies FloatTopupMeta,
    };
    const saved = await this.payrollRunRepository.save(run);
    return { action: 'scheduled', run: saved };
  }

  async assertFundedOrThrow(payrollRunId: string, tenantId: string): Promise<void> {
    const preflight = await this.preflight(payrollRunId, tenantId);
    if (!preflight.ok) {
      throw new BadRequestException(preflight.message);
    }
  }

  async assertRetryFundedOrThrow(
    payrollRunId: string,
    tenantId: string,
    retryItemIds?: string[],
  ): Promise<void> {
    const preflight = await this.preflight(payrollRunId, tenantId, true, retryItemIds);
    // A shared Bachs balance is not proof that this run owns the funds. Until confirmed payout
    // debits and unresolved transfers are reconciled against this run's ledger, fail closed even
    // if a provider balance endpoint or stale run metadata suggests sufficient float.
    if (preflight.provider === PaymentProvider.BACHS) {
      const run = await this.payrollRunRepository.findOne({
        where: { id: payrollRunId, tenantId },
        relations: ['items'],
      });
      let retryFunding = run ? this.readRetryFundingMeta(run) : {};
      // A paid checkout whose webhook was dropped must not strand the run. Re-verify a pending
      // checkout with the provider before failing closed: only server-to-server verification
      // proves the company paid, and the verification is idempotent.
      if (run && retryFunding.status === 'pending' && retryFunding.orderReference) {
        try {
          const verification = await this.verifyRetryFundingCheckout(run);
          if (verification.outcome === 'funded') {
            retryFunding = { ...retryFunding, status: 'funded' };
          }
        } catch (error) {
          this.logger.warn(
            `Retry funding re-verification failed for payroll run ${payrollRunId}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
      const fundedItemIds = new Set(retryFunding.selectedItemIds ?? []);
      const failedItemIds = new Set(
        (run?.items ?? [])
          .filter((item) => item.status === PayrollItemStatus.FAILED)
          .map((item) => item.id),
      );
      const requestedItemIds = [...new Set(retryItemIds?.length ? retryItemIds : failedItemIds)];
      if (requestedItemIds.length === 0) {
        throw new BadRequestException('There are no failed payouts to retry.');
      }
      const notFailed = requestedItemIds.filter((id) => !failedItemIds.has(id));
      if (notFailed.length > 0) {
        throw new BadRequestException(
          'Only payouts that are still failed can be retried. Refresh the run and retry the payouts that still show as failed.',
        );
      }
      if (retryFunding.status !== 'funded' || !retryFunding.orderReference) {
        const hasRetryFundingMeta = Boolean(
          retryFunding.status ||
            retryFunding.orderReference ||
            retryFunding.selectedItemIds?.length,
        );
        let message =
          'Bachs retry requires approved, provider-verified run-scoped funding for the selected failed payouts. ';
        if (!hasRetryFundingMeta) {
          message += 'Follow these steps:\n';
          message += '1. POST /runs/:id/retry-funding/preflight - Preview the funding shortfall\n';
          message += '2. POST /runs/:id/retry-funding/approve - Approve the funding amount\n';
          message += '3. Complete the checkout (if amount > 0)\n';
          message +=
            "4. POST /runs/:id/retry-funding/reconcile - Verify funding (if webhook doesn't fire)\n";
          message += '5. POST /runs/:id/retry-failed-payments - Retry the payouts\n';
        } else if (retryFunding.status === 'approved') {
          message +=
            'Funding is approved but not yet verified. Complete the checkout (if required) or call /runs/:id/retry-funding/reconcile to verify payment before retrying.';
        } else if (retryFunding.status === 'pending') {
          message +=
            'Funding checkout is pending. Complete the checkout or call /runs/:id/retry-funding/reconcile to verify payment before retrying.';
        } else if (retryFunding.status === 'cancelled') {
          message +=
            'The retry funding checkout was cancelled. Open the funding review again, approve the shortfall for the payouts you want to retry, and complete the checkout.';
        } else {
          message +=
            'Open the funding review, approve the shortfall, complete the checkout, then retry once it is verified.';
        }
        message += ' A shared Bachs float balance is not accepted as proof.';
        throw new BadRequestException(message);
      }
      // Funding is approved for a set of failed payouts. Retrying a subset of that set is
      // always covered, so let the user retry only the payouts that are still failed instead of
      // forcing the whole funded set (which may now include payouts that already succeeded).
      const uncoveredItemIds = requestedItemIds.filter((id) => !fundedItemIds.has(id));
      if (uncoveredItemIds.length > 0) {
        throw new BadRequestException(
          `Bachs retry requires approved, provider-verified run-scoped funding that covers every selected payout. ${uncoveredItemIds.length} selected payout(s) are not covered by this run's verified funding. ` +
            'Open the funding review, approve the shortfall for the payouts you want to retry, complete the checkout, then retry once it is verified.',
        );
      }
      // MultiPaymentService independently verifies the approval and funding ledger entries,
      // provider terminal failure, and reservations before it can submit a payout.
      return;
    }
    if (!preflight.ok) {
      throw new BadRequestException(
        `Retry blocked because provider funding is insufficient or cannot be verified. ${preflight.message}`,
      );
    }
  }

  async previewRetryShortfall(
    payrollRunId: string,
    tenantId: string,
    selectedItemIds: string[],
  ): Promise<{
    /** Amount the company pays at checkout (required funding minus the provider balance used). */
    amount: number;
    /** Total run-scoped funding the selected failed payouts need. */
    requiredAmount: number;
    /** Provider balance already covering part of `requiredAmount`, credited to this run. */
    balanceApplied: number;
    availableBalance: number | null;
    currency: string;
    selectedItemIds: string[];
    platformFee: 0;
    payoutFeeReserve: number;
  }> {
    const uniqueIds = [...new Set(selectedItemIds)].sort();
    if (uniqueIds.length === 0) {
      throw new BadRequestException('Select at least one failed payout to preview retry funding');
    }
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items'],
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (hasActivePayrollProcessingLock(run.processingLockedAt)) {
      throw new BadRequestException(
        'Payroll run is currently being processed. Wait before funding a retry.',
      );
    }
    if (run.status !== PayrollStatus.APPROVED && run.status !== PayrollStatus.PROCESSING) {
      throw new BadRequestException('Retry funding requires an approved or processing payroll run');
    }
    await this.assertRetryRunSettled(run, tenantId);
    const existingRetryFunding = this.readRetryFundingMeta(run);
    if (existingRetryFunding.status === 'pending' || existingRetryFunding.status === 'approved') {
      throw new BadRequestException(
        'A retry funding approval or checkout is already active. Complete or reconcile it first, or cancel it to start a fresh funding review.',
      );
    }
    if (
      existingRetryFunding.status === 'funded' &&
      this.isSelectionCoveredByFunded(existingRetryFunding.selectedItemIds, uniqueIds)
    ) {
      throw new BadRequestException(
        'These failed payouts are already covered by verified retry funding. Retry the funded payouts instead of funding them again.',
      );
    }
    const selected = run.items.filter((item) => uniqueIds.includes(item.id));
    if (
      selected.length !== uniqueIds.length ||
      selected.some((item) => item.status !== PayrollItemStatus.FAILED)
    ) {
      throw new BadRequestException(
        'Retry funding can only be previewed for failed items in this run',
      );
    }
    if (selected.some((item) => item.metadata?.payoutSubmissionPending === true)) {
      throw new BadRequestException(
        'A payout with unresolved submission cannot be funded for retry',
      );
    }

    const preflight = await this.preflight(payrollRunId, tenantId, true, uniqueIds);
    if (preflight.provider !== PaymentProvider.BACHS) {
      throw new BadRequestException(
        'This retry funding preview is only available for Bachs payouts',
      );
    }
    if (!preflight.canCheckout && preflight.shortfall > 0) {
      throw new BadRequestException(
        preflight.message || 'Bachs hosted checkout is unavailable for retry funding',
      );
    }
    const allocations = await this.calculateBachsRetryItemFundingAmounts(
      run,
      selected,
      preflight.currency,
    );
    const requiredAmount =
      Math.round(Object.values(allocations).reduce((sum, value) => sum + value, 0) * 100) / 100;
    if (!(requiredAmount > 0)) {
      throw new BadRequestException('Could not calculate a positive retry funding amount');
    }
    // Only the uncovered part is charged: any provider float already held is credited to the run
    // instead of asking the company to pay for the same money twice.
    const amount = Math.min(
      requiredAmount,
      Math.max(0, Math.round(preflight.shortfall * 100) / 100),
    );
    const balanceApplied = Math.round((requiredAmount - amount) * 100) / 100;
    return {
      amount,
      requiredAmount,
      balanceApplied,
      availableBalance: preflight.availableBalance,
      currency: preflight.currency.toUpperCase(),
      selectedItemIds: uniqueIds,
      platformFee: 0,
      payoutFeeReserve: preflight.payoutFeeReserve ?? 0,
    };
  }

  async approveRetryShortfall(
    payrollRunId: string,
    tenantId: string,
    approvedById: string,
    selectedItemIds: string[],
    expectedAmount: number,
    expectedCurrency: string,
  ): Promise<{
    approved: true;
    orderReference: string;
    /** Amount the company pays at checkout (zero when the provider float fully covers the retry). */
    amount: number;
    requiredAmount: number;
    balanceApplied: number;
    currency: string;
    selectedItemIds: string[];
    platformFee: 0;
    payoutFeeReserve: number;
  }> {
    const uniqueIds = [...new Set(selectedItemIds)].sort();
    if (!approvedById || uniqueIds.length === 0) {
      throw new BadRequestException('Select at least one failed payout to approve retry funding');
    }
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items'],
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (hasActivePayrollProcessingLock(run.processingLockedAt)) {
      throw new BadRequestException(
        'Payroll run is currently being processed. Wait before funding a retry.',
      );
    }
    if (run.status !== PayrollStatus.APPROVED && run.status !== PayrollStatus.PROCESSING) {
      throw new BadRequestException('Retry funding requires an approved or processing payroll run');
    }
    await this.assertRetryRunSettled(run, tenantId);
    const existingRetryFunding = this.readRetryFundingMeta(run);
    if (existingRetryFunding.status === 'pending') {
      throw new BadRequestException(
        'A retry funding checkout is already pending. Complete or reconcile it before creating another.',
      );
    }
    if (existingRetryFunding.status === 'approved') {
      throw new BadRequestException(
        'Retry shortfall funding is already approved. Continue to checkout instead of creating another approval.',
      );
    }
    const selected = run.items.filter((item) => uniqueIds.includes(item.id));
    if (
      selected.length !== uniqueIds.length ||
      selected.some((item) => item.status !== PayrollItemStatus.FAILED)
    ) {
      throw new BadRequestException(
        'Retry funding can only be approved for failed items in this payroll run',
      );
    }
    if (selected.some((item) => item.metadata?.payoutSubmissionPending === true)) {
      throw new BadRequestException(
        'A payout with an unresolved submission cannot be funded for retry',
      );
    }

    const preflight = await this.preflight(payrollRunId, tenantId, true, uniqueIds);
    if (preflight.provider !== PaymentProvider.BACHS) {
      throw new BadRequestException(
        'This approval flow is only available for Bachs-backed payroll retries',
      );
    }
    if (!preflight.canCheckout && preflight.shortfall > 0) {
      throw new BadRequestException(
        preflight.message || 'Bachs hosted checkout is unavailable for retry funding',
      );
    }

    const itemFundingAmounts = await this.calculateBachsRetryItemFundingAmounts(
      run,
      selected,
      preflight.currency,
    );
    const requiredAmount =
      Math.round(Object.values(itemFundingAmounts).reduce((sum, amount) => sum + amount, 0) * 100) /
      100;
    if (!(requiredAmount > 0)) {
      throw new BadRequestException('Could not calculate a positive Bachs retry funding amount');
    }
    // The company only pays the part the provider float does not already cover.
    const checkoutAmount = Math.min(
      requiredAmount,
      Math.max(0, Math.round(preflight.shortfall * 100) / 100),
    );
    const balanceApplied = Math.round((requiredAmount - checkoutAmount) * 100) / 100;
    if (
      expectedCurrency.toUpperCase() !== preflight.currency.toUpperCase() ||
      !Number.isFinite(expectedAmount) ||
      Math.abs(checkoutAmount - expectedAmount) > 0.01
    ) {
      throw new BadRequestException(
        'The Bachs quote or available balance changed after preview. Review the updated retry funding amount before approving again.',
      );
    }

    const orderReference = buildPayrollFloatOrderRef(PaymentProvider.BACHS, tenantId);
    await this.payrollRunRepository.manager.transaction(async (manager) => {
      const locked = await manager.getRepository(PayrollRun).findOne({
        where: { id: payrollRunId, tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Payroll run not found');
      if (hasActivePayrollProcessingLock(locked.processingLockedAt)) {
        throw new BadRequestException(
          'Payroll run is currently being processed. Wait before approving retry funding.',
        );
      }
      const latest = this.readRetryFundingMeta(locked);
      if (latest.status === 'approved' || latest.status === 'pending') {
        throw new BadRequestException(
          'Another retry funding approval or checkout is already active for this payroll run. Cancel it first to approve a different amount.',
        );
      }
      if (
        latest.status === 'funded' &&
        this.isSelectionCoveredByFunded(latest.selectedItemIds, uniqueIds)
      ) {
        throw new BadRequestException(
          'These failed payouts are already covered by verified retry funding. Retry the funded payouts instead of funding them again.',
        );
      }

      const lockedItems = await manager.getRepository(PayrollItem).find({
        where: { payrollRunId },
        lock: { mode: 'pessimistic_write' },
      });
      const lockedSelectedItems = lockedItems.filter((item) => uniqueIds.includes(item.id));
      if (
        lockedSelectedItems.length !== uniqueIds.length ||
        lockedSelectedItems.some((item) => item.status !== PayrollItemStatus.FAILED) ||
        lockedItems.some(
          (item) =>
            !uniqueIds.includes(item.id) &&
            (item.status === PayrollItemStatus.PENDING ||
              item.status === PayrollItemStatus.PROCESSING ||
              item.metadata?.payoutSubmissionPending === true),
        )
      ) {
        throw new BadRequestException(
          'Payroll item statuses changed during approval. Reconcile payouts and review the shortfall again.',
        );
      }

      const approvalRepository = manager.getRepository(PayrollRunFundingLedgerEntry);
      const approvalIdempotencyKey = `shortfall-approval:${payrollRunId}:${orderReference}`;
      const existingApproval = await approvalRepository.findOne({
        where: { idempotencyKey: approvalIdempotencyKey },
      });
      if (existingApproval) {
        throw new BadRequestException(
          'Retry funding approval reference already exists. Reconcile the previous approval before continuing.',
        );
      }
      await approvalRepository.insert({
        tenantId,
        payrollRunId,
        payrollItemId: null,
        eventType: PayrollFundingLedgerEventType.SHORTFALL_APPROVED,
        // Approval covers the full run-scoped funding need; the split below records how much the
        // company pays now and how much is credited from the provider float it already holds.
        amount: requiredAmount.toFixed(2),
        currency: preflight.currency.trim().toUpperCase(),
        provider: PaymentProvider.BACHS,
        providerReference: orderReference,
        idempotencyKey: approvalIdempotencyKey,
        performedById: approvedById,
        approvedById,
        evidence: {
          platformFee: 0,
          payoutFeeReserve: preflight.payoutFeeReserve ?? 0,
          approvalType: 'company_funded_retry_shortfall',
          selectedItemIds: uniqueIds.join(','),
          approvalStatus: 'approved',
          checkoutAmount,
          balanceApplied,
          availableBalance: preflight.availableBalance ?? null,
        },
      });

      locked.metadata = {
        ...locked.metadata,
        retryFunding: {
          orderReference,
          status: 'approved',
          selectedItemIds: uniqueIds,
          amount: requiredAmount,
          checkoutAmount,
          balanceApplied,
          availableBalance: preflight.availableBalance ?? undefined,
          currency: preflight.currency,
          provider: PaymentProvider.BACHS,
          approvedById,
          approvedAt: new Date().toISOString(),
          payoutFeeReserve: preflight.payoutFeeReserve ?? 0,
          itemFundingAmounts,
          // Keep the released checkouts so a late payment on one of them is still credited
          // to this run instead of being lost.
          cancelledOrderReferences: latest.cancelledOrderReferences,
        } satisfies RetryFundingMeta,
      };
      await manager.save(locked);
    });

    if (checkoutAmount <= 0) {
      // The provider float already covers the whole retry: credit it to the run so the same
      // guarded ledger path authorizes the payout, and skip checkout entirely.
      await this.applyProviderBalanceRetryFunding({
        tenantId,
        payrollRunId,
        orderReference,
        approvedById,
        requiredAmount,
        currency: preflight.currency,
        selectedItemIds: uniqueIds,
      });
    }

    return {
      approved: true,
      orderReference,
      amount: checkoutAmount,
      requiredAmount,
      balanceApplied,
      currency: preflight.currency,
      selectedItemIds: uniqueIds,
      platformFee: 0,
      payoutFeeReserve: preflight.payoutFeeReserve ?? 0,
    };
  }

  /**
   * Roll a failed checkout creation back to `approved` so the user can try again. Without this
   * the run stays `pending` with no `checkoutUrl`: no checkout can be opened, every retry is
   * rejected, and reconciliation reports `pending` forever.
   */
  private async resetRetryFundingPendingCheckout(
    payrollRunId: string,
    tenantId: string,
    orderReference: string,
    error: unknown,
  ): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    try {
      await this.payrollRunRepository.manager.transaction(async (manager) => {
        const locked = await manager.getRepository(PayrollRun).findOne({
          where: { id: payrollRunId, tenantId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!locked) return;
        const latest = this.readRetryFundingMeta(locked);
        if (
          latest.orderReference !== orderReference ||
          latest.status !== 'pending' ||
          latest.checkoutUrl
        ) {
          return;
        }
        locked.metadata = {
          ...locked.metadata,
          retryFunding: {
            ...latest,
            status: 'approved',
            lastCheckoutError: message.slice(0, 500),
            lastCheckoutErrorAt: new Date().toISOString(),
          } satisfies RetryFundingMeta,
        };
        await manager.save(locked);
      });
    } catch (resetError) {
      this.logger.warn(
        `Failed to reset retry funding checkout state for payroll run ${payrollRunId}: ${
          resetError instanceof Error ? resetError.message : String(resetError)
        }`,
      );
    }
  }

  async createRetryShortfallCheckout(
    payrollRunId: string,
    tenantId: string,
    memberId: string,
  ): Promise<{ checkoutUrl: string; orderReference: string; amount: number; currency: string }> {
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items'],
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (hasActivePayrollProcessingLock(run.processingLockedAt)) {
      throw new BadRequestException(
        'Payroll run is currently being processed. Wait before funding a retry.',
      );
    }
    await this.assertRetryRunSettled(run, tenantId);
    const meta = this.readRetryFundingMeta(run);
    if (meta.status === 'cancelled') {
      throw new BadRequestException(
        'This retry funding was cancelled or expired. Review the funding amount and approve it again before checking out.',
      );
    }
    if (
      !meta.orderReference ||
      !meta.approvedById ||
      !meta.selectedItemIds?.length ||
      !meta.amount ||
      !meta.currency ||
      meta.provider !== PaymentProvider.BACHS ||
      (meta.status !== 'approved' && meta.status !== 'pending')
    ) {
      throw new BadRequestException('Approve retry shortfall funding before creating checkout');
    }
    const checkoutAmount = Number(meta.checkoutAmount ?? meta.amount);
    if (!Number.isFinite(checkoutAmount)) {
      throw new BadRequestException('Retry funding amount is invalid. Approve funding again.');
    }
    const selected = run.items.filter((item) => meta.selectedItemIds?.includes(item.id));
    if (
      selected.length !== meta.selectedItemIds.length ||
      selected.some((item) => item.status !== PayrollItemStatus.FAILED)
    ) {
      throw new BadRequestException(
        'Selected failed payouts changed after approval. Approve funding again.',
      );
    }
    const ledger = await this.fundingLedger.getRunLedger(tenantId, payrollRunId);
    const approval = ledger.entries.find(
      (entry) =>
        entry.eventType === PayrollFundingLedgerEventType.SHORTFALL_APPROVED &&
        entry.providerReference === meta.orderReference &&
        entry.approvedById === meta.approvedById &&
        Number(entry.amount) === Number(meta.amount) &&
        entry.currency === meta.currency?.toUpperCase() &&
        entry.evidence?.selectedItemIds === [...meta.selectedItemIds!].sort().join(','),
    );
    if (!approval) {
      throw new BadRequestException(
        'Retry funding approval evidence is missing or does not match this checkout.',
      );
    }
    if (checkoutAmount <= 0) {
      // Recovery path: approval already credited the provider balance, but the credit or the
      // `funded` flip did not complete. Repeat both idempotently instead of dead-ending.
      await this.applyProviderBalanceRetryFunding({
        tenantId,
        payrollRunId,
        orderReference: meta.orderReference,
        approvedById: meta.approvedById,
        requiredAmount: Number(meta.amount),
        currency: meta.currency,
        selectedItemIds: meta.selectedItemIds,
      });
      return {
        checkoutUrl: '',
        orderReference: meta.orderReference,
        amount: 0,
        currency: meta.currency,
      };
    }
    if (meta.status === 'pending' && meta.checkoutUrl) {
      return {
        checkoutUrl: meta.checkoutUrl,
        orderReference: meta.orderReference,
        amount: checkoutAmount,
        currency: meta.currency,
      };
    }

    // Re-price against the live balance and quotes: a drained float must not under-fund the run,
    // and a quote increase must be re-approved. A larger float is safe to leave as extra credit,
    // so the approved checkout still covers the retry rather than forcing a second approval.
    const livePreflight = await this.preflight(payrollRunId, tenantId, true, meta.selectedItemIds);
    const liveCheckoutAmount = Math.min(
      Number(meta.amount),
      Math.max(0, Math.round(livePreflight.shortfall * 100) / 100),
    );
    if (
      livePreflight.requiredAmount - Number(meta.amount) > 0.01 ||
      liveCheckoutAmount - checkoutAmount > 0.01
    ) {
      throw new BadRequestException(
        'The Bachs quote or available balance changed after preview. Review the updated retry funding amount before checking out.',
      );
    }

    const provider = PaymentProvider.BACHS as PayrollFloatOrderRefProvider;
    const adapter = this.paymentFactory.resolveCheckoutAdapter(provider);
    if (!adapter?.isConfigured()) {
      throw new BadRequestException('Bachs hosted checkout is not configured');
    }
    const customerEmail = await this.resolveBillingEmail(tenantId);
    if (!customerEmail) {
      throw new BadRequestException(
        'Billing contact email is not configured. Add it in Settings → Billing.',
      );
    }
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    const callbackUrl = tenant?.slug
      ? tenantFrontendUrl(tenant.slug, `/payroll?retry_funding=done&runId=${payrollRunId}`)
      : tenantFrontendUrl('', `/payroll?retry_funding=done&runId=${payrollRunId}`);
    // Mark the approved order pending under a row lock before contacting the provider.
    // Never save the stale run object here: a concurrent webhook may already have marked
    // this order funded, and a stale save must not overwrite that terminal state.
    await this.payrollRunRepository.manager.transaction(async (manager) => {
      const locked = await manager.getRepository(PayrollRun).findOne({
        where: { id: payrollRunId, tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Payroll run not found');
      const latest = this.readRetryFundingMeta(locked);
      if (latest.orderReference !== meta.orderReference) {
        throw new BadRequestException('Retry funding approval changed before checkout creation');
      }
      if (latest.status === 'funded') {
        throw new BadRequestException('Retry funding checkout has already been verified');
      }
      // A pending checkout with no URL is either being created by another request or its
      // creation failed after the pending flag was written. Allow a retry once the in-flight
      // window has passed, otherwise the run is wedged with no checkout and no way out.
      let effective = latest;
      if (latest.status === 'pending') {
        const requestedAt = latest.checkoutRequestedAt
          ? Date.parse(latest.checkoutRequestedAt)
          : Number.NaN;
        const inFlight = Number.isFinite(requestedAt) && Date.now() - requestedAt < 180_000;
        if (inFlight) {
          throw new BadRequestException(
            'Retry funding checkout is already being created or reconciled. Check its status before retrying.',
          );
        }
        effective = { ...latest, status: 'approved' };
      }
      if (effective.status !== 'approved') {
        throw new BadRequestException('Retry funding approval is no longer active');
      }
      const lockedItems = await manager.getRepository(PayrollItem).find({
        where: { payrollRunId },
        lock: { mode: 'pessimistic_write' },
      });
      const effectiveSelectedIds = effective.selectedItemIds;
      const selectedItems = lockedItems.filter((item) => effectiveSelectedIds?.includes(item.id));
      if (
        selectedItems.length !== effectiveSelectedIds?.length ||
        selectedItems.some((item) => item.status !== PayrollItemStatus.FAILED) ||
        lockedItems.some(
          (item) =>
            !effectiveSelectedIds?.includes(item.id) &&
            (item.status === PayrollItemStatus.PENDING ||
              item.status === PayrollItemStatus.PROCESSING ||
              item.metadata?.payoutSubmissionPending === true),
        )
      ) {
        throw new BadRequestException(
          'Selected failed payouts changed before checkout creation. Review the shortfall again.',
        );
      }
      locked.metadata = {
        ...locked.metadata,
        retryFunding: {
          ...effective,
          status: 'pending',
          checkoutRequestedAt: new Date().toISOString(),
        } satisfies RetryFundingMeta,
      };
      await manager.save(locked);
    });

    let checkout: { orderReference: string; checkoutLink: string };
    try {
      checkout = await adapter.createCheckout({
        orderReference: meta.orderReference,
        customerEmail,
        amount: checkoutAmount,
        currency: meta.currency,
        callbackUrl,
        customerName: resolveCheckoutCustomerFullName(tenant?.name, customerEmail),
        savePaymentMethod: false,
        meta: {
          tenantId,
          payrollRunId,
          billingType: 'payroll_retry_funding',
          expectedAmount: String(checkoutAmount),
          selectedItemIds: meta.selectedItemIds.join(','),
          approvedById: meta.approvedById,
          initiatedByMemberId: memberId,
        },
      });

      if (checkout.orderReference !== meta.orderReference) {
        throw new BadRequestException(
          'Bachs checkout returned a different order reference. Reconcile this checkout before retrying.',
        );
      }
    } catch (error) {
      await this.resetRetryFundingPendingCheckout(
        payrollRunId,
        tenantId,
        meta.orderReference,
        error,
      );
      throw error;
    }
    await this.payrollRunRepository.manager.transaction(async (manager) => {
      const locked = await manager.getRepository(PayrollRun).findOne({
        where: { id: payrollRunId, tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Payroll run not found');
      const latest = this.readRetryFundingMeta(locked);
      if (latest.orderReference !== meta.orderReference) {
        throw new BadRequestException(
          'Retry funding order reference changed while checkout was created',
        );
      }
      locked.metadata = {
        ...locked.metadata,
        retryFunding: {
          ...latest,
          status: latest.status === 'funded' ? 'funded' : 'pending',
          checkoutUrl: checkout.checkoutLink,
        } satisfies RetryFundingMeta,
      };
      await manager.save(locked);
    });
    return {
      checkoutUrl: checkout.checkoutLink,
      orderReference: checkout.orderReference,
      amount: checkoutAmount,
      currency: meta.currency,
    };
  }

  /**
   * Credit a retry that the provider float already covers, without creating a checkout.
   * The run-scoped ledger entry is what authorizes the guarded retry, so it is recorded before
   * the metadata flips to `funded`; both steps are safe to repeat.
   */
  private async applyProviderBalanceRetryFunding(input: {
    tenantId: string;
    payrollRunId: string;
    orderReference: string;
    approvedById: string;
    requiredAmount: number;
    currency: string;
    selectedItemIds: string[];
  }): Promise<void> {
    await this.fundingLedger.recordVerifiedFunding({
      tenantId: input.tenantId,
      payrollRunId: input.payrollRunId,
      amount: input.requiredAmount,
      currency: input.currency,
      provider: PaymentProvider.BACHS,
      providerReference: input.orderReference,
      performedById: input.approvedById,
      evidence: {
        fundingPurpose: 'approved_retry_shortfall',
        selectedItemIds: [...input.selectedItemIds].sort().join(','),
        approvedById: input.approvedById,
        checkoutAmount: 0,
        balanceApplied: input.requiredAmount,
        fundingSource: 'provider_balance',
      },
    });
    await this.payrollRunRepository.manager.transaction(async (manager) => {
      const locked = await manager.getRepository(PayrollRun).findOne({
        where: { id: input.payrollRunId, tenantId: input.tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) return;
      const latest = this.readRetryFundingMeta(locked);
      if (latest.orderReference !== input.orderReference || latest.status !== 'approved') return;
      locked.metadata = {
        ...locked.metadata,
        retryFunding: {
          ...latest,
          status: 'funded',
          fundedAt: new Date().toISOString(),
        } satisfies RetryFundingMeta,
      };
      await manager.save(locked);
    });
  }

  private async calculateBachsRetryItemFundingAmounts(
    run: PayrollRun,
    selectedItems: PayrollRun['items'],
    fundingCurrency: string,
  ): Promise<Record<string, number>> {
    const allocations: Record<string, number> = {};
    let total = 0;
    for (const item of selectedItems) {
      const fundingItem = this.buildBachsFundingItems({
        ...run,
        items: [item],
      } as PayrollRun)[0];
      if (!fundingItem) {
        throw new BadRequestException(
          `Could not calculate retry funding for payroll item ${item.id}`,
        );
      }
      const allocation = await sourceAmountWithPayoutFeeForBachsFundingItem({
        item: fundingItem,
        fundingCurrency: fundingCurrency as 'USD' | 'NGN',
        createQuote: (input) => this.bachsApi.createPayoutQuote(input),
      });
      const amount = allocation.sourceAmount + allocation.payoutFeeReserve;
      const rounded = Math.round(amount * 100) / 100;
      if (!(rounded > 0)) {
        throw new BadRequestException(
          `Invalid retry funding allocation for payroll item ${item.id}`,
        );
      }
      allocations[item.id] = rounded;
      total += rounded;
    }

    // Keep the sum exactly equal to the amount the company funds.
    const roundedTotal = Math.round(total * 100) / 100;
    const keys = Object.keys(allocations);
    const difference =
      Math.round(
        (roundedTotal - Object.values(allocations).reduce((sum, amount) => sum + amount, 0)) * 100,
      ) / 100;
    if (keys.length > 0 && difference !== 0) {
      allocations[keys[keys.length - 1]] =
        Math.round((allocations[keys[keys.length - 1]] + difference) * 100) / 100;
    }
    return allocations;
  }

  private async assertRetryRunSettled(run: PayrollRun, tenantId: string): Promise<void> {
    if (
      run.processingLockedAt &&
      Date.now() - new Date(run.processingLockedAt).getTime() < 30 * 60 * 1000
    ) {
      throw new BadRequestException(
        'Payroll run is currently being processed. Wait for processing to finish before retry funding.',
      );
    }
    if (
      (run.items ?? []).some(
        (item) =>
          item.status === PayrollItemStatus.PENDING ||
          item.status === PayrollItemStatus.PROCESSING ||
          item.metadata?.payoutSubmissionPending === true,
      )
    ) {
      throw new BadRequestException(
        'Resolve all pending payroll payouts before approving or funding a retry shortfall.',
      );
    }
    const ledger = await this.fundingLedger.getRunLedger(tenantId, run.id);
    const releasedReservationKeys = new Set(
      ledger.entries
        .filter((entry) => entry.eventType === PayrollFundingLedgerEventType.RESERVATION_RELEASED)
        .map((entry) => entry.evidence?.releasedReservationKey)
        .filter((key): key is string => typeof key === 'string'),
    );
    const hasActiveReservation = ledger.entries.some((entry) => {
      if (entry.eventType !== PayrollFundingLedgerEventType.PAYOUT_RESERVED) return false;
      const reservationKey =
        typeof entry.evidence?.reservationKey === 'string' ? entry.evidence.reservationKey : '';
      return Boolean(reservationKey) && !releasedReservationKeys.has(reservationKey);
    });
    if (hasActiveReservation) {
      throw new BadRequestException(
        'A prior retry reservation is still active. Reconcile the previous payout attempt before approving more funding.',
      );
    }
    const debitedItemIds = new Set(
      ledger.entries
        .filter((entry) => entry.eventType === PayrollFundingLedgerEventType.PAYOUT_CONFIRMED)
        .map((entry) => entry.payrollItemId)
        .filter((id): id is string => Boolean(id)),
    );
    const unreconciledPaidItems = (run.items ?? []).filter(
      (item) => item.status === PayrollItemStatus.PAID && !debitedItemIds.has(item.id),
    );
    if (unreconciledPaidItems.length > 0) {
      // A paid item whose debit was never booked is repairable: only the provider knows
      // whether the money left the float. The payroll sweep books the same debits, but it
      // runs on a timer, and a tenant that asks to fund a retry cannot wait for it.
      await this.reconcilePaidItemDebits(run, unreconciledPaidItems, tenantId);
      const refreshed = await this.fundingLedger.getRunLedger(tenantId, run.id);
      const reconciledItemIds = new Set(
        refreshed.entries
          .filter((entry) => entry.eventType === PayrollFundingLedgerEventType.PAYOUT_CONFIRMED)
          .map((entry) => entry.payrollItemId)
          .filter((id): id is string => Boolean(id)),
      );
      const stillUnreconciled = unreconciledPaidItems.filter(
        (item) => !reconciledItemIds.has(item.id),
      );
      if (stillUnreconciled.length > 0) {
        throw new BadRequestException(
          'Reconcile all paid payroll items against provider-confirmed debits before retry funding.',
        );
      }
    }
  }

  /**
   * Ask the provider which paid items debited the float, and book the ones it confirms.
   *
   * A payout can be paid while its ledger write is lost, and the provider is the only
   * source that can say the money left the balance. Items the provider cannot confirm
   * stay unreconciled, and the caller keeps the run closed.
   */
  private async reconcilePaidItemDebits(
    run: PayrollRun,
    items: PayrollRun['items'],
    tenantId: string,
  ): Promise<void> {
    for (const item of items) {
      const transactionId = item.transactionId?.trim();
      if (!transactionId) {
        this.logger.warn(
          `Payroll item ${item.id} is paid without a provider transaction id, so its debit cannot be confirmed`,
        );
        continue;
      }
      const retryAttempt =
        typeof item.metadata?.payoutRetryCount === 'number' ? item.metadata.payoutRetryCount : 0;
      try {
        await this.payrollPayoutService.recordConfirmedBachsDebit({
          tenantId,
          payrollRunId: run.id,
          payrollItemId: item.id,
          transactionId,
          merchantReference: buildPayrollMerchantRef(run.id, item.id, retryAttempt),
          destinationAmount: Number(item.paymentAmount),
        });
      } catch (error) {
        this.logger.warn(
          `Could not confirm the provider debit for payroll item ${item.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  private readRetryFundingMeta(run: PayrollRun): RetryFundingMeta {
    const raw = run.metadata?.retryFunding;
    if (!raw || typeof raw !== 'object') return {};
    return raw as RetryFundingMeta;
  }

  /** True when every requested item is already covered by the funded selection. */
  private isSelectionCoveredByFunded(funded?: string[], requested?: string[]): boolean {
    const fundedIds = new Set(funded ?? []);
    const requestedIds = [...new Set(requested ?? [])];
    return requestedIds.length > 0 && requestedIds.every((id) => fundedIds.has(id));
  }

  async completeFloatTopup(input: {
    tenantId: string;
    orderReference: string;
    amount?: number;
    initiatedByMemberId?: string;
    payrollRunId?: string;
  }): Promise<{ received: boolean; paid: boolean }> {
    const run = await this.findRunForTopup(input);
    if (!run) {
      this.logger.warn(`Payroll float top-up ignored: run not found for ${input.orderReference}`);
      return { received: true, paid: false };
    }

    const retryFunding = this.readRetryFundingMeta(run);
    if (retryFunding.orderReference === input.orderReference) {
      return this.completeRetryFundingCheckout(run, input, retryFunding);
    }
    // A checkout the user released can still be paid from a provider window they left open.
    // The money still belongs to this run, so credit it instead of dropping the payment.
    if (retryFunding.cancelledOrderReferences?.includes(input.orderReference)) {
      return this.completeCancelledRetryFundingCheckout(run, input);
    }

    const meta = this.readFloatTopupMeta(run);
    if (!meta.orderReference || meta.orderReference !== input.orderReference) {
      this.logger.warn(
        `Payroll float top-up rejected: checkout reference mismatch for ${input.orderReference}`,
      );
      return { received: true, paid: false };
    }
    if (meta.status === 'completed') {
      return { received: true, paid: run.payoutMode !== 'scheduled' };
    }

    const provider = resolvePaymentProvider(run.baseCurrency) as PayrollFloatOrderRefProvider;
    const adapter = this.paymentFactory.resolveCheckoutAdapter(provider);
    if (!adapter?.isConfigured()) {
      this.logger.warn(
        `Payroll float top-up rejected: checkout adapter unavailable for ${input.orderReference}`,
      );
      return { received: true, paid: false };
    }

    const verified = await adapter.verifyCheckout({ orderReference: input.orderReference });
    if (!verified) {
      this.logger.warn(
        `Payroll float top-up rejected: verification missing for ${input.orderReference}`,
      );
      return { received: true, paid: false };
    }

    const status = verified.status.toLowerCase();
    if (!SUCCESSFUL_CHECKOUT_STATUSES.has(status)) {
      this.logger.warn(
        `Payroll float top-up not successful yet for ${input.orderReference}: ${verified.status}`,
      );
      return { received: true, paid: false };
    }

    const expected = Number(meta.shortfall);
    // The webhook payload is only a notification. Never use its amount as proof of payment:
    // only the provider's server-to-server verification response may fund a payroll run.
    const verifiedAmount = Number(verified.amount);
    if (
      !Number.isFinite(verifiedAmount) ||
      verifiedAmount <= 0 ||
      !Number.isFinite(expected) ||
      expected <= 0
    ) {
      this.logger.warn(
        `Payroll float top-up missing a valid verified amount or expected amount for ${input.orderReference}`,
      );
      return { received: true, paid: false };
    }
    const verifiedCurrency =
      typeof verified.currency === 'string' ? verified.currency.toUpperCase() : undefined;
    const expectedCurrency = (meta.fundingCurrency || run.baseCurrency).toUpperCase();
    if (provider === PaymentProvider.BACHS && !verifiedCurrency) {
      this.logger.warn(
        `Payroll float top-up rejected: Bachs verification did not return currency for ${input.orderReference}`,
      );
      return { received: true, paid: false };
    }
    if (verifiedCurrency && verifiedCurrency !== expectedCurrency) {
      this.logger.warn(
        `Payroll float top-up currency mismatch for ${input.orderReference}: expected ${expectedCurrency}, got ${verifiedCurrency}`,
      );
      return { received: true, paid: false };
    }
    const paidAmount = normalizeWebhookAmount(verifiedAmount, expected, expectedCurrency);
    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      this.logger.warn(`Payroll float top-up invalid verified amount for ${input.orderReference}`);
      return { received: true, paid: false };
    }
    if (expected > 0 && paidAmount + BILLING_AMOUNT_TOLERANCE < expected) {
      this.logger.warn(
        `Payroll float top-up underpaid for ${input.orderReference}: expected ${expected}, got ${paidAmount}`,
      );
      return { received: true, paid: false };
    }
    if (expected > 0 && paidAmount > expected + BILLING_AMOUNT_TOLERANCE) {
      this.logger.warn(
        `Payroll float top-up overpaid for ${input.orderReference}: expected ${expected}, got ${paidAmount}`,
      );
    }

    // Persist the provider-verified credit before triggering payouts. The unique provider
    // reference makes webhook retries idempotent and binds this credit to this payroll run.
    await this.fundingLedger.recordVerifiedFunding({
      tenantId: run.tenantId,
      payrollRunId: run.id,
      amount: paidAmount,
      currency: expectedCurrency,
      provider,
      providerReference: input.orderReference,
      performedById: input.initiatedByMemberId,
      evidence: {
        verifiedStatus: verified.status,
        verifiedAmount,
        expectedAmount: expected,
        currencyReportedByProvider: verifiedCurrency ?? null,
      },
    });

    const claimed = await this.claimFloatTopupCompleted({
      runId: run.id,
      tenantId: run.tenantId,
      orderReference: input.orderReference,
      shortfall: meta.shortfall,
      provider,
      fundingCurrency: meta.fundingCurrency,
    });
    if (!claimed) {
      // Duplicate webhook delivery must not imply that a scheduled run was paid early.
      return { received: true, paid: run.payoutMode !== 'scheduled' };
    }

    if (claimed.payoutMode === 'scheduled') {
      return { received: true, paid: false };
    }

    if (claimed.status !== PayrollStatus.APPROVED) {
      this.logger.warn(
        `Payroll float top-up completed but run ${claimed.id} status is ${claimed.status}; skipping auto-pay`,
      );
      return { received: true, paid: false };
    }

    const performedById = input.initiatedByMemberId || claimed.createdById;
    try {
      await this.paymentOrchestrator.payNowPayroll(claimed.id, claimed.tenantId, {
        tenantId: claimed.tenantId,
        payrollRunId: claimed.id,
        performedById,
      });
      return { received: true, paid: true };
    } catch (error) {
      this.logger.error(
        `Auto pay-now after float top-up failed for run ${claimed.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { received: true, paid: false };
    }
  }

  private async completeRetryFundingCheckout(
    run: PayrollRun,
    input: {
      orderReference: string;
      initiatedByMemberId?: string;
    },
    meta: RetryFundingMeta,
  ): Promise<{ received: boolean; paid: boolean }> {
    const verification = await this.verifyRetryFundingCheckout(
      run,
      input.initiatedByMemberId ?? meta.approvedById,
    );
    if (verification.outcome === 'pending') {
      this.logger.warn(
        `Retry funding for ${input.orderReference} is not verified yet: ${verification.reason}`,
      );
    }
    // Funding is allocated to the run, but this callback must never initiate payouts.
    // The retry endpoint performs fresh provider-status checks and reserves funds first.
    return { received: true, paid: false };
  }

  /**
   * A payment that landed on a retry funding checkout this run already released.
   *
   * The user kept the provider window open and paid after cancelling. The money is credited to
   * the run's funding ledger so it is accounted for, and the operator is warned because the
   * released approval cannot fund a retry on its own — support settles it with the tenant.
   */
  private async completeCancelledRetryFundingCheckout(
    run: PayrollRun,
    input: {
      orderReference: string;
      initiatedByMemberId?: string;
    },
  ): Promise<{ received: boolean; paid: boolean }> {
    const provider = PaymentProvider.BACHS as PayrollFloatOrderRefProvider;
    const adapter = this.paymentFactory.resolveCheckoutAdapter(provider);
    if (!adapter?.isConfigured()) {
      this.logger.warn(
        `Cancelled retry funding payment ignored: checkout adapter unavailable for ${input.orderReference}`,
      );
      return { received: true, paid: false };
    }
    const verified = await adapter.verifyCheckout({ orderReference: input.orderReference });
    if (!verified || !SUCCESSFUL_CHECKOUT_STATUSES.has(verified.status.toLowerCase())) {
      this.logger.warn(
        `Cancelled retry funding payment ignored: provider has not confirmed ${input.orderReference}`,
      );
      return { received: true, paid: false };
    }
    const verifiedAmount = Number(verified.amount);
    const verifiedCurrency =
      typeof verified.currency === 'string' ? verified.currency.toUpperCase() : undefined;
    if (!Number.isFinite(verifiedAmount) || verifiedAmount <= 0 || !verifiedCurrency) {
      this.logger.warn(
        `Cancelled retry funding payment ignored: invalid verified amount for ${input.orderReference}`,
      );
      return { received: true, paid: false };
    }
    try {
      await this.fundingLedger.recordVerifiedFunding({
        tenantId: run.tenantId,
        payrollRunId: run.id,
        amount: verifiedAmount,
        currency: verifiedCurrency,
        provider,
        providerReference: input.orderReference,
        performedById: input.initiatedByMemberId,
        evidence: {
          verifiedStatus: verified.status,
          verifiedAmount,
          currencyReportedByProvider: verifiedCurrency,
          fundingPurpose: 'cancelled_retry_shortfall_late_payment',
          cancelledOrderReference: input.orderReference,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Could not credit the late payment for cancelled retry funding ${input.orderReference}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { received: true, paid: false };
    }
    this.logger.warn(
      `Retry funding checkout ${input.orderReference} was paid after it was cancelled. ${verifiedAmount} ${verifiedCurrency} was credited to payroll run ${run.id}; review the run and settle it with the tenant.`,
    );
    return { received: true, paid: false };
  }

  /**
   * Re-verify a pending run-scoped retry funding checkout with the provider. This is the only
   * repair path for a paid checkout whose webhook never landed (or was answered after the run
   * moved on): it proves the company's payment server-to-server, credits the run's funding
   * ledger, and marks the retry funding funded so the guarded retry flow can proceed.
   *
   * It never initiates payouts, and it is idempotent — the ledger credit is keyed by the
   * provider reference and the metadata flip short-circuits when already funded.
   */
  async reconcileRetryFunding(
    payrollRunId: string,
    tenantId: string,
    performedById?: string,
  ): Promise<RetryFundingReconcileStatus> {
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      select: { id: true, tenantId: true, status: true, metadata: true },
    });
    if (!run) throw new NotFoundException('Payroll run not found');

    const verification = await this.verifyRetryFundingCheckout(run, performedById);
    if (verification.outcome === 'funded') {
      return {
        status: 'funded',
        orderReference: verification.orderReference,
        amount: verification.amount,
        currency: verification.currency,
      };
    }
    if (verification.outcome === 'pending') {
      const meta = this.readRetryFundingMeta(run);
      if (meta.status === 'cancelled') {
        // The funding was released, so there is nothing left to wait for. A late payment on a
        // cancelled checkout is still credited to the run when it lands.
        return {
          status: 'unavailable',
          orderReference: verification.orderReference,
          reason: 'retry_funding_cancelled',
        };
      }
      return {
        status: 'pending',
        orderReference: verification.orderReference,
        reason: verification.reason,
      };
    }
    const meta = this.readRetryFundingMeta(run);
    if (meta.status === 'funded' && meta.orderReference) {
      return {
        status: 'funded',
        orderReference: meta.orderReference,
        amount: meta.amount,
        currency: meta.currency,
      };
    }
    return {
      status: 'unavailable',
      orderReference: meta.orderReference,
      reason: 'no_pending_retry_funding_checkout',
    };
  }

  private async verifyRetryFundingCheckout(
    run: PayrollRun,
    performedById?: string,
  ): Promise<RetryFundingVerification> {
    const meta = this.readRetryFundingMeta(run);
    const orderReference = meta.orderReference?.trim();
    // A cancelled checkout can still be paid from a provider window the user left open, so a
    // cancelled order reference is verified too: the money must reach the run either way.
    if (!orderReference || (meta.status !== 'pending' && meta.status !== 'cancelled')) {
      return { outcome: 'not_pending' };
    }
    if (!meta.approvedById || !meta.selectedItemIds?.length || !meta.amount || !meta.currency) {
      return { outcome: 'pending', orderReference, reason: 'retry_funding_metadata_incomplete' };
    }
    if (run.status !== PayrollStatus.APPROVED && run.status !== PayrollStatus.PROCESSING) {
      return { outcome: 'pending', orderReference, reason: 'payroll_run_not_active' };
    }

    const provider = PaymentProvider.BACHS as PayrollFloatOrderRefProvider;
    const adapter = this.paymentFactory.resolveCheckoutAdapter(provider);
    if (!adapter?.isConfigured()) {
      return { outcome: 'pending', orderReference, reason: 'checkout_adapter_unavailable' };
    }
    const verified = await adapter.verifyCheckout({ orderReference });
    if (!verified || !SUCCESSFUL_CHECKOUT_STATUSES.has(verified.status.toLowerCase())) {
      return { outcome: 'pending', orderReference, reason: 'provider_payment_not_successful' };
    }

    const verifiedAmount = Number(verified.amount);
    const verifiedCurrency =
      typeof verified.currency === 'string' ? verified.currency.toUpperCase() : undefined;
    const fundedAmount = Math.round(Number(meta.amount) * 100) / 100;
    // The checkout only asks for the part the provider float did not already cover.
    const expectedAmount = Math.round(Number(meta.checkoutAmount ?? meta.amount) * 100) / 100;
    const expectedCurrency = meta.currency.toUpperCase();
    if (
      !Number.isFinite(verifiedAmount) ||
      verifiedAmount <= 0 ||
      !verifiedCurrency ||
      verifiedCurrency !== expectedCurrency
    ) {
      return { outcome: 'pending', orderReference, reason: 'provider_amount_currency_mismatch' };
    }
    const paidAmount =
      Math.round(normalizeWebhookAmount(verifiedAmount, expectedAmount, expectedCurrency) * 100) /
      100;
    if (!Number.isFinite(paidAmount) || paidAmount < expectedAmount) {
      return { outcome: 'pending', orderReference, reason: 'checkout_underpaid' };
    }
    const balanceApplied =
      Math.round(Number(meta.balanceApplied ?? fundedAmount - expectedAmount) * 100) / 100;
    if (
      !Number.isFinite(balanceApplied) ||
      balanceApplied < 0 ||
      Math.abs(expectedAmount + balanceApplied - fundedAmount) > 0.01
    ) {
      // Never credit the run with money the company did not pay and the provider balance
      // did not already hold; a mismatch would let a retry spend the float twice.
      return { outcome: 'pending', orderReference, reason: 'retry_funding_split_mismatch' };
    }

    const selectedItemIds = [...meta.selectedItemIds].sort();
    const runStillExists = await this.payrollRunRepository.exists({
      where: { id: run.id, tenantId: run.tenantId },
    });
    if (!runStillExists) {
      return { outcome: 'pending', orderReference, reason: 'payroll_run_missing' };
    }

    // Once the provider confirms that the company paid, record the full run-scoped funding even
    // if payroll item statuses changed while checkout was open. The retry path separately
    // revalidates every selected item and cannot spend this credit unless the approval matches.
    // `checkoutAmount` is the money the company just paid; `balanceApplied` was already held in
    // the provider float and credited to this run.
    await this.fundingLedger.recordVerifiedFunding({
      tenantId: run.tenantId,
      payrollRunId: run.id,
      amount: fundedAmount,
      currency: expectedCurrency,
      provider,
      providerReference: orderReference,
      performedById: performedById ?? meta.approvedById,
      evidence: {
        verifiedStatus: verified.status,
        verifiedAmount,
        expectedAmount,
        checkoutAmount: Math.min(paidAmount, expectedAmount),
        balanceApplied,
        currencyReportedByProvider: verifiedCurrency,
        fundingPurpose: 'approved_retry_shortfall',
        selectedItemIds: selectedItemIds.join(','),
        approvedById: meta.approvedById,
      },
    });

    const markedFunded = await this.payrollRunRepository.manager.transaction(async (manager) => {
      const locked = await manager.getRepository(PayrollRun).findOne({
        where: { id: run.id, tenantId: run.tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Payroll run not found');
      const latest = this.readRetryFundingMeta(locked);
      if (latest.orderReference !== orderReference) return false;
      if (latest.status === 'funded') return true;
      if (latest.status !== 'pending' && latest.status !== 'cancelled') return false;
      locked.metadata = {
        ...locked.metadata,
        retryFunding: {
          ...latest,
          status: 'funded',
          fundedAt: new Date().toISOString(),
        } satisfies RetryFundingMeta,
      };
      await manager.save(locked);
      return true;
    });
    if (!markedFunded) {
      return { outcome: 'pending', orderReference, reason: 'retry_funding_state_changed' };
    }

    this.logger.log(
      `Retry funding verified for payroll run ${run.id} (${orderReference}): ${fundedAmount} ${expectedCurrency} (checkout ${paidAmount}, balance ${balanceApplied})`,
    );
    return {
      outcome: 'funded',
      orderReference,
      amount: fundedAmount,
      currency: expectedCurrency,
    };
  }

  /**
   * Cancel an open retry funding approval or checkout.
   *
   * The provider is asked first whether the company actually paid. A paid checkout is never
   * cancelled: it is credited to the run instead, so a dropped webhook can never turn into a
   * second payment for the same shortfall. Only an approval (no checkout was ever opened) or a
   * checkout the provider confirms is unpaid can be released, and releasing only unlocks the
   * run for a fresh approval — it never moves money.
   */
  async cancelRetryFunding(
    payrollRunId: string,
    tenantId: string,
    performedById?: string | null,
    options?: { reason?: string; staleBefore?: Date },
  ): Promise<RetryFundingCancelStatus> {
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      select: { id: true, tenantId: true, status: true, metadata: true },
    });
    if (!run) throw new NotFoundException('Payroll run not found');

    const meta = this.readRetryFundingMeta(run);
    if (!meta.orderReference || !meta.status) {
      throw new BadRequestException('There is no retry funding to cancel on this payroll run.');
    }
    if (meta.status === 'funded') {
      return {
        status: 'funded',
        orderReference: meta.orderReference,
        amount: meta.amount,
        currency: meta.currency,
        reason: 'retry_funding_already_verified',
      };
    }
    if (meta.status === 'cancelled') {
      return {
        status: 'cancelled',
        orderReference: meta.orderReference,
        amount: meta.amount,
        currency: meta.currency,
        reason: 'retry_funding_already_cancelled',
      };
    }
    if (meta.status !== 'approved' && meta.status !== 'pending') {
      throw new BadRequestException(
        'There is no open retry funding to cancel on this payroll run.',
      );
    }

    if (meta.status === 'pending') {
      const paymentState = await this.resolveRetryFundingPaymentState(meta.orderReference);
      if (paymentState.state === 'paid') {
        // The company paid but the webhook never landed. Credit the run instead of cancelling:
        // cancelling here would let the user pay a second time for the same shortfall.
        const verification = await this.verifyRetryFundingCheckout(run, performedById ?? undefined);
        if (verification.outcome === 'funded') {
          return {
            status: 'funded',
            orderReference: verification.orderReference,
            amount: verification.amount,
            currency: verification.currency,
            reason: 'retry_funding_verified_on_cancel',
          };
        }
        throw new BadRequestException(
          'This retry funding checkout was already paid but could not be credited to the run yet. ' +
            'Contact PaqadHR support so we can verify the payment before you retry.',
        );
      }
      if (paymentState.state === 'unknown') {
        throw new BadRequestException(
          `We could not confirm with the payment provider whether this checkout was paid (${paymentState.reason}). ` +
            'Try again in a moment, or contact PaqadHR support to have it reviewed.',
        );
      }
    }

    return this.markRetryFundingCancelled({
      payrollRunId,
      tenantId,
      orderReference: meta.orderReference,
      performedById,
      reason: options?.reason ?? 'cancelled_by_user',
      staleBefore: options?.staleBefore,
    });
  }

  /**
   * Release an open retry funding approval or checkout under a row lock and record the release
   * in the run's funding ledger. Cancelling never debits or credits anything: the ledger entry
   * is history that shows which approval was dropped.
   */
  private async markRetryFundingCancelled(input: {
    payrollRunId: string;
    tenantId: string;
    orderReference: string;
    performedById?: string | null;
    reason: string;
    /** Only release funding that has been open since before this moment. */
    staleBefore?: Date;
  }): Promise<RetryFundingCancelStatus> {
    const cancelledAt = new Date().toISOString();
    const outcome = await this.payrollRunRepository.manager.transaction(async (manager) => {
      const locked = await manager.getRepository(PayrollRun).findOne({
        where: { id: input.payrollRunId, tenantId: input.tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Payroll run not found');
      const latest = this.readRetryFundingMeta(locked);
      if (latest.orderReference !== input.orderReference) {
        return { status: 'not_pending' as const, reason: 'retry_funding_state_changed' };
      }
      if (latest.status === 'funded') {
        return {
          status: 'funded' as const,
          orderReference: latest.orderReference,
          amount: latest.amount,
          currency: latest.currency,
        };
      }
      if (latest.status === 'cancelled') {
        return {
          status: 'cancelled' as const,
          orderReference: latest.orderReference,
          amount: latest.amount,
          currency: latest.currency,
          reason: 'retry_funding_already_cancelled',
        };
      }
      if (latest.status !== 'approved' && latest.status !== 'pending') {
        return { status: 'not_pending' as const, reason: 'retry_funding_state_changed' };
      }
      if (input.staleBefore) {
        // The checkout may have been re-created while this release was queued. Only release
        // funding that has been open since before the caller's cutoff.
        const pendingSince = latest.checkoutRequestedAt ?? latest.approvedAt;
        const pendingSinceMs = pendingSince ? Date.parse(pendingSince) : Number.NaN;
        if (!Number.isFinite(pendingSinceMs) || pendingSinceMs >= input.staleBefore.getTime()) {
          return { status: 'not_pending' as const, reason: 'retry_funding_not_stale' };
        }
      }
      const { checkoutUrl: _staleCheckoutUrl, ...rest } = latest;
      locked.metadata = {
        ...locked.metadata,
        retryFunding: {
          ...rest,
          status: 'cancelled',
          cancelledAt,
          cancelledById: input.performedById ?? null,
          cancelReason: input.reason,
          cancelledOrderReferences: [
            ...(latest.cancelledOrderReferences ?? []),
            latest.orderReference,
          ].slice(-5),
        } satisfies RetryFundingMeta,
      };
      await manager.save(locked);
      return {
        status: 'cancelled' as const,
        orderReference: latest.orderReference,
        amount: latest.amount,
        currency: latest.currency,
      };
    });

    if (outcome.status === 'cancelled') {
      await this.fundingLedger.recordRetryShortfallCancellation({
        tenantId: input.tenantId,
        payrollRunId: input.payrollRunId,
        orderReference: input.orderReference,
        amount: outcome.amount ?? 0,
        currency: outcome.currency ?? 'NGN',
        provider: PaymentProvider.BACHS,
        performedById: input.performedById ?? null,
        reason: input.reason,
        cancelledAt,
      });
    }
    return outcome;
  }

  /**
   * Ask the provider whether a retry funding checkout was actually paid.
   *
   * `not_paid` is only returned when the provider answered and did not report a successful
   * payment, so it is safe to release the checkout on that answer. `unknown` means the provider
   * could not be reached or answered with something that cannot be read, and the checkout must
   * not be released because the money may already be gone.
   */
  private async resolveRetryFundingPaymentState(
    orderReference: string,
  ): Promise<{ state: 'not_paid' } | { state: 'paid' } | { state: 'unknown'; reason: string }> {
    const provider = PaymentProvider.BACHS as PayrollFloatOrderRefProvider;
    const adapter = this.paymentFactory.resolveCheckoutAdapter(provider);
    if (!adapter?.isConfigured()) {
      return { state: 'unknown', reason: 'checkout_adapter_unavailable' };
    }
    let verified: Awaited<ReturnType<typeof adapter.verifyCheckout>>;
    try {
      verified = await adapter.verifyCheckout({ orderReference });
    } catch (error) {
      this.logger.warn(
        `Retry funding payment state check failed for ${orderReference}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { state: 'unknown', reason: 'provider_unreachable' };
    }
    if (!verified) return { state: 'not_paid' };
    if (SUCCESSFUL_CHECKOUT_STATUSES.has(verified.status.toLowerCase())) {
      return { state: 'paid' };
    }
    return { state: 'not_paid' };
  }

  /**
   * Cancel retry funding that stayed open longer than the pending window.
   *
   * Each candidate is verified with the provider first: a checkout that was paid is credited to
   * the run instead of being cancelled, and a checkout the provider cannot answer is left alone
   * so the next sweep can retry it. Only abandoned, unpaid funding is released.
   */
  async expireStaleRetryFunding(now: Date = new Date()): Promise<{
    expired: number;
    verified: number;
    skipped: number;
  }> {
    const cutoff = new Date(now.getTime() - RETRY_FUNDING_PENDING_TTL_MS);
    const runs = await this.payrollRunRepository.findRunsWithOpenRetryFundingBefore(cutoff);
    let expired = 0;
    let verified = 0;
    let skipped = 0;
    for (const run of runs) {
      const meta = this.readRetryFundingMeta(run);
      if (!meta.orderReference) continue;
      try {
        const result = await this.cancelRetryFunding(run.id, run.tenantId, null, {
          reason: 'expired_after_pending_timeout',
          staleBefore: cutoff,
        });
        if (result.status === 'cancelled') {
          expired += 1;
        } else if (result.status === 'funded') {
          verified += 1;
        } else {
          skipped += 1;
        }
      } catch (error) {
        // A provider outage or a state change is not a reason to release funding that may have
        // been paid. Leave it pending and try again on the next sweep.
        skipped += 1;
        this.logger.warn(
          `Could not expire stale retry funding for payroll run ${run.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return { expired, verified, skipped };
  }

  private async createFloatTopupCheckout(
    payrollRunId: string,
    tenantId: string,
    memberId: string,
    preflight: PayrollFundPreflight,
  ): Promise<{ checkoutUrl: string; orderReference: string }> {
    const provider = preflight.provider as PayrollFloatOrderRefProvider;
    if (!this.balanceService.supportsHostedFloatTopup(provider)) {
      throw new BadRequestException(preflight.message);
    }

    const adapter = this.paymentFactory.resolveCheckoutAdapter(provider);
    if (!adapter?.isConfigured()) {
      throw new BadRequestException(
        `Checkout is not configured for ${provider}. Fund via ${preflight.dashboardUrl || 'the provider dashboard'}.`,
      );
    }

    const customerEmail = await this.resolveBillingEmail(tenantId);
    if (!customerEmail) {
      throw new BadRequestException(
        'Billing contact email is not configured. Add it in Settings → Billing.',
      );
    }

    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    const callbackUrl = tenant?.slug
      ? tenantFrontendUrl(tenant.slug, `/payroll?fund_pay=done&runId=${payrollRunId}`)
      : tenantFrontendUrl('', `/payroll?fund_pay=done&runId=${payrollRunId}`);

    const orderReference = buildPayrollFloatOrderRef(provider, tenantId);
    const amount = preflight.shortfall;
    const meta = {
      tenantId,
      payrollRunId,
      billingType: 'payroll_float_topup',
      expectedAmount: String(amount),
      initiatedByMemberId: memberId,
    };

    const result = await adapter.createCheckout({
      orderReference,
      customerEmail,
      amount,
      currency: preflight.currency,
      callbackUrl,
      customerName: resolveCheckoutCustomerFullName(tenant?.name, customerEmail),
      // Payroll float funding is a one-time payment. Do not request a saved payment
      // method: Bachs bank transfer is not supported when saving a method for later.
      savePaymentMethod: false,
      meta,
    });

    const run = await this.requireApprovedRun(payrollRunId, tenantId);
    run.metadata = {
      ...run.metadata,
      floatTopup: {
        orderReference: result.orderReference,
        status: 'pending',
        shortfall: amount,
        provider,
        fundingCurrency: preflight.currency,
      } satisfies FloatTopupMeta,
    };
    await this.payrollRunRepository.save(run);

    return {
      checkoutUrl: result.checkoutLink,
      orderReference: result.orderReference,
    };
  }

  private toIsoDatePart(value: Date | string): string {
    return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  }

  private async requireApprovedRun(payrollRunId: string, tenantId: string): Promise<PayrollRun> {
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items'],
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (hasActivePayrollProcessingLock(run.processingLockedAt)) {
      throw new BadRequestException(
        'Payroll run is currently being processed. Wait before funding a retry.',
      );
    }
    if (run.status !== PayrollStatus.APPROVED) {
      throw new BadRequestException(`Must be APPROVED. Current: ${run.status}`);
    }
    return run;
  }

  private payableNet(run: PayrollRun): number {
    const items = run.items ?? [];
    if (items.length === 0) {
      return Math.round(Number(run.totalNetAmount ?? 0) * 100) / 100;
    }
    const sum = items
      .filter(
        (item) =>
          item.status === PayrollItemStatus.PENDING || item.status === PayrollItemStatus.FAILED,
      )
      .reduce((acc, item) => acc + Number(item.netAmount ?? 0), 0);
    return Math.round(sum * 100) / 100;
  }

  private countPayableTransfers(run: PayrollRun, currency: string): number {
    const currencyCode = currency.toUpperCase();
    return (run.items ?? []).filter(
      (item) =>
        (item.status === PayrollItemStatus.PENDING || item.status === PayrollItemStatus.FAILED) &&
        item.metadata?.excludedFromRun !== true &&
        (item.paymentCurrency || run.baseCurrency).toUpperCase() === currencyCode &&
        Number(resolvePayrollPayoutAmount(item)) > 0,
    ).length;
  }

  private providerDisplayName(provider: PaymentProvider): string {
    switch (provider) {
      case PaymentProvider.BACHS:
        return 'Bachs';
      case PaymentProvider.NOAH:
        return 'Noah';
      case PaymentProvider.FINCRA:
        return 'Fincra';
      case PaymentProvider.NOMBA:
        return 'Nomba';
      case PaymentProvider.MONNIFY:
        return 'Monnify';
      default:
        return 'the payment provider';
    }
  }

  /**
   * When the run’s payout rail is Bachs, quote every payable item into one funding currency
   * (USD if anyone is paid internationally / USDT; otherwise NGN), add the Paqad fee, and
   * return a company-checkout preflight. Null when Bachs is not the run provider.
   */
  private async tryBachsFundingPreflight(
    run: PayrollRun,
    tenantId: string,
    forRetry = false,
  ): Promise<PayrollFundPreflight | null> {
    if (!isBachsConfigured()) return null;
    const baseProvider = resolvePaymentProvider(run.baseCurrency);
    if (baseProvider !== PaymentProvider.BACHS) return null;

    const fundingItems = this.buildBachsFundingItems(run);
    if (fundingItems.length === 0) {
      return {
        ok: true,
        provider: PaymentProvider.BACHS,
        currency: run.baseCurrency.toUpperCase(),
        requiredAmount: 0,
        availableBalance: null,
        shortfall: 0,
        balanceSupported: false,
        canCheckout: false,
        dashboardUrl: '',
        message: 'No payable amount on this run.',
      };
    }

    // Mixed Bachs checkout only when every payable item will actually disburse on Bachs.
    if (!fundingItems.every((item) => this.itemRoutesToBachs(item))) {
      return null;
    }

    const existingTopup = run.metadata?.floatTopup;
    const existingFundingCurrency =
      forRetry &&
      existingTopup &&
      typeof existingTopup === 'object' &&
      'provider' in existingTopup &&
      existingTopup.provider === PaymentProvider.BACHS &&
      'fundingCurrency' in existingTopup &&
      (existingTopup.fundingCurrency === 'USD' || existingTopup.fundingCurrency === 'NGN')
        ? existingTopup.fundingCurrency
        : undefined;
    // Retries must use the same source currency as the original Bachs payout path. A selected
    // subset may otherwise choose NGN while PaymentBatching still debits the run's USD float.
    const fundingCurrency =
      existingFundingCurrency ??
      pickBachsFundingCurrency(fundingItems, getBachsPayoutSourceCurrency());
    if (!isBachsWalletTopupConfigured(fundingCurrency)) {
      throw new BadRequestException(
        `Bachs checkout is not configured for ${fundingCurrency}. Set BACHS_WALLET_TOPUP_PRODUCT_${fundingCurrency}.`,
      );
    }

    try {
      // Quote each payout once, then add the marked-up Bachs withdrawal fee in the currency
      // the balance is debited in. Quotes exclude that fee, so omitting it under-funds the run
      // by one fee per employee and the last payout fails.
      let employeeTotal = 0;
      let payoutFeeReserve = 0;
      let payoutTransferCount = 0;
      for (const item of fundingItems) {
        const allocation = await sourceAmountWithPayoutFeeForBachsFundingItem({
          item,
          fundingCurrency,
          createQuote: (input) => this.bachsApi.createPayoutQuote(input),
        });
        employeeTotal += allocation.sourceAmount;
        payoutFeeReserve += allocation.payoutFeeReserve;
        if (allocation.payoutFeeReserve > 0) payoutTransferCount += 1;
      }
      employeeTotal = Math.round(employeeTotal * 100) / 100;
      payoutFeeReserve = Math.round(payoutFeeReserve * 100) / 100;
      const feePercentage = await this.payrollFeeService.getPayrollFeePercentage(tenantId);
      const fee = applyPayrollFee(employeeTotal, feePercentage);
      const payoutFeePerTransfer =
        payoutTransferCount > 0
          ? Math.round((payoutFeeReserve / payoutTransferCount) * 100) / 100
          : 0;
      // Retry funding covers only the failed employee payouts and required provider
      // reserves. The PaqadHR platform fee was charged on the original payroll run and must
      // not be charged a second time.
      const requiredAmount =
        Math.round(((forRetry ? fee.employeeTotal : fee.checkoutTotal) + payoutFeeReserve) * 100) /
        100;
      if (forRetry) {
        const canCheckout = this.balanceService.supportsHostedFloatTopup(PaymentProvider.BACHS);
        // A retry only needs to top up the difference between what the failed payouts need and
        // what the company already holds in the provider float. Charging the full amount again
        // would double-fund the run whenever the float already covers part of it.
        const balance = await this.balanceService.getAvailableBalance(
          PaymentProvider.BACHS,
          fundingCurrency,
        );
        const available = balance.supported ? balance.available : null;
        const shortfall =
          available == null
            ? requiredAmount
            : Math.max(0, Math.round((requiredAmount - available) * 100) / 100);
        return {
          ok: shortfall <= 0,
          provider: PaymentProvider.BACHS,
          currency: fundingCurrency,
          requiredAmount,
          availableBalance: available,
          shortfall,
          balanceSupported: balance.supported,
          canCheckout,
          dashboardUrl: '',
          message:
            shortfall <= 0 && available != null
              ? `Your Bachs balance (${available} ${fundingCurrency}) already covers the ${requiredAmount} ${fundingCurrency} these failed payouts need. Retry the selected payouts.`
              : canCheckout
                ? `The selected failed payouts need ${requiredAmount} ${fundingCurrency}. Your Bachs balance covers ${available ?? 0} ${fundingCurrency}, so checkout only asks for the remaining ${shortfall} ${fundingCurrency}. The PaqadHR platform fee is not charged again.`
                : `Fund the remaining ${shortfall} ${fundingCurrency} for the selected failed payouts in Bachs, then reconcile the verified funding.`,
          employeeTotal: fee.employeeTotal,
          platformFee: 0,
          feePercentage: 0,
          payoutFeeReserve,
          payoutFeePerTransfer,
          payoutTransferCount,
        };
      }

      const balance = await this.balanceService.getAvailableBalance(
        PaymentProvider.BACHS,
        fundingCurrency,
      );
      const available = balance.supported ? balance.available : null;
      const shortfall =
        available == null
          ? requiredAmount
          : Math.max(0, Math.round((requiredAmount - available) * 100) / 100);
      const canCheckout = this.balanceService.supportsHostedFloatTopup(PaymentProvider.BACHS);

      if (shortfall <= 0 && available != null) {
        return {
          ok: true,
          provider: PaymentProvider.BACHS,
          currency: fundingCurrency,
          requiredAmount,
          availableBalance: available,
          shortfall: 0,
          balanceSupported: true,
          canCheckout,
          dashboardUrl: '',
          message:
            'Bachs balance already covers this payroll run, including the PaqadHR fee and payout-fee reserve.',
          employeeTotal: fee.employeeTotal,
          platformFee: fee.platformFee,
          feePercentage: fee.feePercentage,
          payoutFeeReserve,
          payoutFeePerTransfer,
          payoutTransferCount,
        };
      }

      return {
        ok: false,
        provider: PaymentProvider.BACHS,
        currency: fundingCurrency,
        requiredAmount,
        availableBalance: available,
        shortfall,
        balanceSupported: balance.supported,
        canCheckout,
        dashboardUrl: '',
        message: canCheckout
          ? `Your company pays ${requiredAmount} ${fundingCurrency} in one checkout (${fee.employeeTotal} employee pay + ${fee.platformFee} PaqadHR fee at ${fee.feePercentage}% + ${payoutFeeReserve} payout-fee reserve for ${payoutTransferCount} transfer(s)). We then route each salary via Bachs.`
          : `Fund ${requiredAmount} ${fundingCurrency} on Bachs, including the payout-fee reserve, then retry.`,
        employeeTotal: fee.employeeTotal,
        platformFee: fee.platformFee,
        feePercentage: fee.feePercentage,
        payoutFeeReserve,
        payoutFeePerTransfer,
        payoutTransferCount,
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Bachs payroll funding quote failed: ${detail}`);
      throw new BadRequestException(
        `Could not price this payroll on Bachs (${detail}). Check employee payment methods and try again.`,
      );
    }
  }

  private itemRoutesToBachs(item: BachsFundingItem): boolean {
    const methodType = isCryptoCurrency(item.paymentCurrency)
      ? PaymentMethodType.CRYPTO
      : PaymentMethodType.BANK;
    return (
      resolvePaymentProvider(item.paymentCurrency, methodType, item.cryptoNetwork ?? undefined) ===
      PaymentProvider.BACHS
    );
  }

  private buildBachsFundingItems(run: PayrollRun): BachsFundingItem[] {
    const items = run.items ?? [];
    const result: BachsFundingItem[] = [];
    for (const item of items) {
      if (item.status !== PayrollItemStatus.PENDING && item.status !== PayrollItemStatus.FAILED) {
        continue;
      }
      if (item.metadata?.excludedFromRun === true) continue;
      const paymentCurrency = (item.paymentCurrency || run.baseCurrency).toUpperCase();
      const fxAtPayout = item.metadata?.fxAtPayout === true;
      const amount = resolvePayrollPayoutAmount(item);
      if (!(amount > 0)) continue;
      const amountCurrency = fxAtPayout
        ? (item.baseSalaryCurrency || run.baseCurrency).toUpperCase()
        : paymentCurrency;
      const cryptoNetwork =
        typeof item.metadata?.cryptoNetwork === 'string' ? item.metadata.cryptoNetwork : null;
      result.push({
        amount,
        amountCurrency,
        paymentCurrency,
        cryptoNetwork,
        fxAtPayout,
      });
    }
    return result;
  }

  private readFloatTopupMeta(run: PayrollRun): FloatTopupMeta {
    const raw = run.metadata?.floatTopup;
    if (!raw || typeof raw !== 'object') return {};
    return raw as FloatTopupMeta;
  }

  private async findRunForTopup(input: {
    tenantId: string;
    orderReference: string;
    payrollRunId?: string;
  }): Promise<PayrollRun | null> {
    if (input.payrollRunId) {
      return this.payrollRunRepository.findOne({
        where: { id: input.payrollRunId, tenantId: input.tenantId },
      });
    }

    return this.payrollRunRepository
      .createQueryBuilder('run')
      .where('run.tenantId = :tenantId', { tenantId: input.tenantId })
      .andWhere(
        `((run.metadata::jsonb -> 'floatTopup' ->> 'orderReference') = :ref OR (run.metadata::jsonb -> 'retryFunding' ->> 'orderReference') = :ref OR (run.metadata::jsonb -> 'retryFunding' -> 'cancelledOrderReferences') @> to_jsonb(:ref::text))`,
        { ref: input.orderReference },
      )
      .getOne();
  }

  /**
   * Atomically mark float top-up completed. Returns the locked run when this caller wins the claim;
   * null when another delivery already completed the same orderReference.
   */
  private async claimFloatTopupCompleted(input: {
    runId: string;
    tenantId: string;
    orderReference: string;
    shortfall?: number;
    provider: string;
    fundingCurrency?: string;
  }): Promise<PayrollRun | null> {
    return this.payrollRunRepository.manager.transaction(async (manager) => {
      const locked = await manager
        .getRepository(PayrollRun)
        .createQueryBuilder('run')
        .setLock('pessimistic_write')
        .where('run.id = :id', { id: input.runId })
        .andWhere('run.tenantId = :tenantId', { tenantId: input.tenantId })
        .getOne();
      if (!locked) return null;

      const meta = this.readFloatTopupMeta(locked);
      if (!meta.orderReference || meta.orderReference !== input.orderReference) {
        return null;
      }
      if (meta.status === 'completed') {
        return null;
      }

      locked.metadata = {
        ...locked.metadata,
        floatTopup: {
          orderReference: input.orderReference,
          status: 'completed',
          completedAt: new Date().toISOString(),
          shortfall: input.shortfall ?? meta.shortfall,
          provider: input.provider,
          fundingCurrency: input.fundingCurrency ?? meta.fundingCurrency,
        } satisfies FloatTopupMeta,
      };
      await manager.save(locked);
      return locked;
    });
  }

  private async resolveBillingEmail(tenantId: string): Promise<string | null> {
    try {
      const settings = await this.tenantSettingsService.getTenantSettings(tenantId);
      const contactEmail = settings.settings.billing?.contactEmail?.trim();
      if (contactEmail) return contactEmail;
    } catch {
      // fall through
    }
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
      relations: ['createdBy'],
    });
    return tenant?.createdBy?.email?.trim() ?? null;
  }
}
