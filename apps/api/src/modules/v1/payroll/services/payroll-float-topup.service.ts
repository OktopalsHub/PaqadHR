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
  quoteSourceAmountForDestination,
  resolveBachsQuoteDestinationCurrency,
  sourceAmountForBachsFundingItem,
  sumBachsFundingSourceAmount,
} from 'src/common/config/bachs-funding-quote.util';
import {
  calculatePayrollPayoutFeeReserve,
  getPayrollPayoutFeePerTransfer,
  hasConfiguredPayrollPayoutFee,
} from 'src/common/config/payroll-payout-fee.util';
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
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollFundingLedgerEventType } from '../entities/payroll-run-funding-ledger-entry.entity';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import {
  buildPayrollFloatOrderRef,
  type PayrollFloatOrderRefProvider,
} from '../utils/payroll-float-order-ref.util';
import { resolvePayrollPayoutAmount } from '../utils/payroll-payment.util';
import { PayrollFeeService } from './payroll-fee.service';
import { PayrollFloatBalanceService } from './payroll-float-balance.service';
import { PayrollPaymentOrchestrator } from './payroll-payment-orchestrator';
import { PayrollRunFundingLedgerService } from './payroll-run-funding-ledger.service';

const SUCCESSFUL_CHECKOUT_STATUSES = new Set(['success', 'successful', 'succeeded', 'accepted']);

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

type RetryFundingMeta = {
  orderReference?: string;
  status?: 'approved' | 'pending' | 'funded';
  selectedItemIds?: string[];
  amount?: number;
  currency?: string;
  provider?: string;
  approvedById?: string;
  approvedAt?: string;
  checkoutUrl?: string;
  fundedAt?: string;
  itemFundingAmounts?: Record<string, number>;
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
        shortfall: preflight.requiredAmount,
        message: `Your company pays ${preflight.requiredAmount} ${preflight.currency}${feeNote} in checkout. We then route each employee’s salary via ${this.providerDisplayName(preflight.provider)}.`,
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
        shortfall: preflight.requiredAmount,
        message: `Your company pays ${preflight.requiredAmount} ${preflight.currency}${feeNote} now. Employees are paid on ${this.toIsoDatePart(run.paymentDate)} via ${this.providerDisplayName(preflight.provider)}.`,
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
      const retryFunding = run ? this.readRetryFundingMeta(run) : {};
      const selectedItemIds = [...(retryFunding.selectedItemIds ?? [])].sort();
      const requestedItemIds = (
        retryItemIds ??
        run?.items
          .filter((item) => item.status === PayrollItemStatus.FAILED)
          .map((item) => item.id) ??
        []
      ).sort();
      if (
        retryFunding.status !== 'funded' ||
        !retryFunding.orderReference ||
        selectedItemIds.length !== requestedItemIds.length ||
        selectedItemIds.some((id, index) => id !== requestedItemIds[index])
      ) {
        throw new BadRequestException(
          'Bachs retry requires approved, provider-verified run-scoped funding for exactly the selected failed payouts. Shared Bachs float alone is not sufficient.',
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

  async approveRetryShortfall(
    payrollRunId: string,
    tenantId: string,
    approvedById: string,
    selectedItemIds: string[],
  ): Promise<{
    approved: true;
    orderReference: string;
    amount: number;
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
    if (!preflight.canCheckout || preflight.requiredAmount <= 0) {
      throw new BadRequestException(
        preflight.message || 'Bachs hosted checkout is unavailable for retry funding',
      );
    }

    const itemFundingAmounts = await this.calculateBachsRetryItemFundingAmounts(
      run,
      selected,
      preflight.currency,
    );
    const approvedAmount =
      Math.round(Object.values(itemFundingAmounts).reduce((sum, amount) => sum + amount, 0) * 100) /
      100;
    if (!(approvedAmount > 0)) {
      throw new BadRequestException('Could not calculate a positive Bachs retry funding amount');
    }

    const orderReference = buildPayrollFloatOrderRef(PaymentProvider.BACHS, tenantId);
    await this.fundingLedger.recordRetryShortfallApproval({
      tenantId,
      payrollRunId,
      selectedItemIds: uniqueIds,
      amount: approvedAmount,
      currency: preflight.currency,
      approvedById,
      provider: PaymentProvider.BACHS,
      approvalReference: orderReference,
      evidence: {
        platformFee: 0,
        payoutFeeReserve: preflight.payoutFeeReserve ?? 0,
        approvalType: 'company_funded_retry_shortfall',
      },
    });

    await this.payrollRunRepository.manager.transaction(async (manager) => {
      const locked = await manager.getRepository(PayrollRun).findOne({
        where: { id: payrollRunId, tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Payroll run not found');
      const latest = this.readRetryFundingMeta(locked);
      if (latest.status === 'approved' || latest.status === 'pending') {
        throw new BadRequestException(
          'Another retry funding approval or checkout is already active for this payroll run.',
        );
      }
      locked.metadata = {
        ...locked.metadata,
        retryFunding: {
          orderReference,
          status: 'approved',
          selectedItemIds: uniqueIds,
          amount: approvedAmount,
          currency: preflight.currency,
          provider: PaymentProvider.BACHS,
          approvedById,
          approvedAt: new Date().toISOString(),
          itemFundingAmounts,
        } satisfies RetryFundingMeta,
      };
      await manager.save(locked);
    });
    return {
      approved: true,
      orderReference,
      amount: approvedAmount,
      currency: preflight.currency,
      selectedItemIds: uniqueIds,
      platformFee: 0,
      payoutFeeReserve: preflight.payoutFeeReserve ?? 0,
    };
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
    await this.assertRetryRunSettled(run, tenantId);
    const meta = this.readRetryFundingMeta(run);
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
    if (meta.status === 'pending' && meta.checkoutUrl) {
      return {
        checkoutUrl: meta.checkoutUrl,
        orderReference: meta.orderReference,
        amount: meta.amount,
        currency: meta.currency,
      };
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
    // Persist the order reference before calling the provider. If the provider creates
    // the checkout but this request times out, the webhook can still resolve the pending
    // retry-funding attempt and repeated calls will reuse the same reference.
    run.metadata = {
      ...run.metadata,
      retryFunding: {
        ...meta,
        status: 'pending',
      } satisfies RetryFundingMeta,
    };
    await this.payrollRunRepository.save(run);

    const checkout = await adapter.createCheckout({
      orderReference: meta.orderReference,
      customerEmail,
      amount: meta.amount,
      currency: meta.currency,
      callbackUrl,
      customerName: resolveCheckoutCustomerFullName(tenant?.name, customerEmail),
      savePaymentMethod: false,
      meta: {
        tenantId,
        payrollRunId,
        billingType: 'payroll_retry_funding',
        expectedAmount: String(meta.amount),
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
      amount: meta.amount,
      currency: meta.currency,
    };
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
      let amount = await sourceAmountForBachsFundingItem({
        item: fundingItem,
        fundingCurrency: fundingCurrency as 'USD' | 'NGN',
        createQuote: (input) => this.bachsApi.createPayoutQuote(input),
      });

      const sameCurrency =
        fundingItem.paymentCurrency.toUpperCase() === fundingItem.amountCurrency.toUpperCase();
      if (sameCurrency) {
        const payoutCurrency = fundingItem.paymentCurrency.toUpperCase();
        const feeAmount = getPayrollPayoutFeePerTransfer(payoutCurrency, PaymentProvider.BACHS);
        if (feeAmount > 0) {
          if (payoutCurrency === fundingCurrency.toUpperCase()) {
            amount += feeAmount;
          } else {
            const destination = resolveBachsQuoteDestinationCurrency(
              payoutCurrency,
              fundingItem.cryptoNetwork,
            );
            if (!destination) {
              throw new BadRequestException(
                `Cannot convert the ${payoutCurrency} payout-fee reserve into ${fundingCurrency}`,
              );
            }
            const quotedReserve = await quoteSourceAmountForDestination({
              createQuote: (input) => this.bachsApi.createPayoutQuote(input),
              fromCurrency: fundingCurrency,
              toCurrency: destination,
              targetToAmount: feeAmount,
              payoutMethod:
                destination.startsWith('USDT_') || destination.startsWith('USDC_')
                  ? undefined
                  : 'BANK_TRANSFER',
            });
            amount += quotedReserve.sourceAmount;
          }
        }
      }
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
    const debitedItemIds = new Set(
      ledger.entries
        .filter((entry) => entry.eventType === PayrollFundingLedgerEventType.PAYOUT_CONFIRMED)
        .map((entry) => entry.payrollItemId)
        .filter((id): id is string => Boolean(id)),
    );
    if (
      (run.items ?? []).some(
        (item) => item.status === PayrollItemStatus.PAID && !debitedItemIds.has(item.id),
      )
    ) {
      throw new BadRequestException(
        'Reconcile all paid payroll items against provider-confirmed debits before retry funding.',
      );
    }
  }

  private readRetryFundingMeta(run: PayrollRun): RetryFundingMeta {
    const raw = run.metadata?.retryFunding;
    if (!raw || typeof raw !== 'object') return {};
    return raw as RetryFundingMeta;
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
      tenantId: string;
      orderReference: string;
      initiatedByMemberId?: string;
    },
    meta: RetryFundingMeta,
  ): Promise<{ received: boolean; paid: boolean }> {
    if (
      meta.status === 'funded' ||
      !meta.approvedById ||
      !meta.selectedItemIds?.length ||
      !meta.amount ||
      !meta.currency
    ) {
      return { received: true, paid: false };
    }
    if (run.status !== PayrollStatus.APPROVED && run.status !== PayrollStatus.PROCESSING) {
      this.logger.warn(`Retry funding rejected for non-active payroll run ${run.id}`);
      return { received: true, paid: false };
    }

    const provider = PaymentProvider.BACHS as PayrollFloatOrderRefProvider;
    const adapter = this.paymentFactory.resolveCheckoutAdapter(provider);
    if (!adapter?.isConfigured()) return { received: true, paid: false };
    const verified = await adapter.verifyCheckout({ orderReference: input.orderReference });
    if (!verified || !SUCCESSFUL_CHECKOUT_STATUSES.has(verified.status.toLowerCase())) {
      return { received: true, paid: false };
    }

    const verifiedAmount = Number(verified.amount);
    const verifiedCurrency =
      typeof verified.currency === 'string' ? verified.currency.toUpperCase() : undefined;
    const expectedAmount = Number(meta.amount);
    const expectedCurrency = meta.currency.toUpperCase();
    if (
      !Number.isFinite(verifiedAmount) ||
      verifiedAmount <= 0 ||
      !verifiedCurrency ||
      verifiedCurrency !== expectedCurrency
    ) {
      this.logger.warn(`Retry funding checkout verification invalid for ${input.orderReference}`);
      return { received: true, paid: false };
    }
    const paidAmount =
      Math.round(normalizeWebhookAmount(verifiedAmount, expectedAmount, expectedCurrency) * 100) /
      100;
    const exactExpectedAmount = Math.round(expectedAmount * 100) / 100;
    if (!Number.isFinite(paidAmount) || paidAmount < exactExpectedAmount) {
      this.logger.warn(
        `Retry funding checkout underpayment for ${input.orderReference}: expected at least ${exactExpectedAmount}, verified ${paidAmount}`,
      );
      return { received: true, paid: false };
    }

    const selectedItemIds = [...meta.selectedItemIds].sort();
    const currentRun = await this.payrollRunRepository.findOne({
      where: { id: run.id, tenantId: input.tenantId },
      relations: ['items'],
    });
    if (!currentRun) {
      this.logger.warn(`Retry funding run disappeared before checkout completion: ${run.id}`);
      return { received: true, paid: false };
    }

    // Once the provider confirms that the company paid, record the money even if payroll
    // item statuses changed while checkout was open. The retry path separately revalidates
    // every selected item and cannot spend this credit unless the approval still matches.
    await this.fundingLedger.recordVerifiedFunding({
      tenantId: run.tenantId,
      payrollRunId: run.id,
      amount: paidAmount,
      currency: expectedCurrency,
      provider,
      providerReference: input.orderReference,
      performedById: input.initiatedByMemberId ?? meta.approvedById,
      evidence: {
        verifiedStatus: verified.status,
        verifiedAmount,
        expectedAmount,
        currencyReportedByProvider: verifiedCurrency,
        fundingPurpose: 'approved_retry_shortfall',
        selectedItemIds: selectedItemIds.join(','),
        approvedById: meta.approvedById,
      },
    });

    await this.payrollRunRepository.manager.transaction(async (manager) => {
      const locked = await manager.getRepository(PayrollRun).findOne({
        where: { id: run.id, tenantId: input.tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Payroll run not found');
      const latest = this.readRetryFundingMeta(locked);
      if (latest.orderReference !== input.orderReference) {
        throw new BadRequestException(
          'Retry funding checkout reference changed during verification',
        );
      }
      if (latest.status === 'funded') return;
      if (latest.status !== 'pending') {
        throw new BadRequestException('Retry funding checkout is not pending');
      }
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

    // Funding is allocated to the run, but this callback must never initiate payouts.
    // The retry endpoint performs fresh provider-status checks and reserves funds first.
    return { received: true, paid: false };
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
      const employeeTotal = await sumBachsFundingSourceAmount({
        items: fundingItems,
        fundingCurrency,
        createQuote: (input) => this.bachsApi.createPayoutQuote(input),
      });
      const feePercentage = await this.payrollFeeService.getPayrollFeePercentage(tenantId);
      const fee = applyPayrollFee(employeeTotal, feePercentage);
      // Cross-currency payouts (GBP/EUR/USDT/USDC and USD-funded NGN) use Bachs'
      // live quote, which includes the current FX and payout costs in the source amount.
      // Same-currency payouts cannot be quoted, so require an explicit per-transfer reserve
      // rather than silently undercharging USD payouts.
      // A configured reserve applies to same-currency payouts in their payout currency,
      // not just payouts whose currency matches the checkout balance. Convert each reserve
      // into the funding currency before calculating the checkout total.
      const sameCurrencyItems = fundingItems.filter(
        (item) => item.paymentCurrency.toUpperCase() === item.amountCurrency.toUpperCase(),
      );
      const payoutTransferCount = sameCurrencyItems.filter(
        (item) => getPayrollPayoutFeePerTransfer(item.paymentCurrency, PaymentProvider.BACHS) > 0,
      ).length;
      if (
        sameCurrencyItems.some((item) => item.paymentCurrency.toUpperCase() === 'USD') &&
        !hasConfiguredPayrollPayoutFee('USD', PaymentProvider.BACHS)
      ) {
        throw new Error(
          'Set PAYROLL_PAYOUT_FEE_BACHS_USD to the confirmed Bachs fee per same-currency USD payout before pricing this payroll.',
        );
      }
      let payoutFeeReserve = 0;
      for (const item of sameCurrencyItems) {
        const payoutCurrency = item.paymentCurrency.toUpperCase();
        const feeAmount = getPayrollPayoutFeePerTransfer(payoutCurrency, PaymentProvider.BACHS);
        if (feeAmount <= 0) continue;
        if (payoutCurrency === fundingCurrency) {
          payoutFeeReserve += feeAmount;
          continue;
        }
        const destination = resolveBachsQuoteDestinationCurrency(
          payoutCurrency,
          item.cryptoNetwork,
        );
        if (!destination) {
          throw new Error(
            `Cannot convert the ${payoutCurrency} payout-fee reserve into ${fundingCurrency}`,
          );
        }
        const quotedReserve = await quoteSourceAmountForDestination({
          createQuote: (input) => this.bachsApi.createPayoutQuote(input),
          fromCurrency: fundingCurrency,
          toCurrency: destination,
          targetToAmount: feeAmount,
          payoutMethod:
            destination.startsWith('USDT_') || destination.startsWith('USDC_')
              ? undefined
              : 'BANK_TRANSFER',
        });
        payoutFeeReserve += quotedReserve.sourceAmount;
      }
      payoutFeeReserve = Math.round(payoutFeeReserve * 100) / 100;
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
        return {
          ok: false,
          provider: PaymentProvider.BACHS,
          currency: fundingCurrency,
          requiredAmount,
          availableBalance: null,
          shortfall: requiredAmount,
          balanceSupported: false,
          canCheckout,
          dashboardUrl: '',
          message: canCheckout
            ? `Approve and fund ${requiredAmount} ${fundingCurrency} for the selected failed payouts. The PaqadHR platform fee is not charged again.`
            : `Fund ${requiredAmount} ${fundingCurrency} for the selected failed payouts in Bachs, then reconcile the verified funding.`,
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
          ? `Your company pays ${requiredAmount} ${fundingCurrency} in one checkout (${fee.employeeTotal} employee pay + ${fee.platformFee} PaqadHR fee at ${fee.feePercentage}% + ${payoutFeeReserve} payout-fee reserve for ${payoutTransferCount} same-currency transfer(s)). We then route each salary via Bachs.`
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
        `((run.metadata::jsonb -> 'floatTopup' ->> 'orderReference') = :ref OR (run.metadata::jsonb -> 'retryFunding' ->> 'orderReference') = :ref)`,
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
