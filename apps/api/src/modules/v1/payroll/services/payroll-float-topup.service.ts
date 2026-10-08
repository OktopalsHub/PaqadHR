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
  sumBachsFundingSourceAmount,
} from 'src/common/config/bachs-funding-quote.util';
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
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import {
  buildPayrollFloatOrderRef,
  type PayrollFloatOrderRefProvider,
} from '../utils/payroll-float-order-ref.util';
import { resolvePayrollPayoutAmount } from '../utils/payroll-payment.util';
import { PayrollFeeService } from './payroll-fee.service';
import { PayrollFloatBalanceService } from './payroll-float-balance.service';
import { PayrollPaymentOrchestrator } from './payroll-payment-orchestrator';

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
};

type FloatTopupMeta = {
  orderReference?: string;
  status?: 'pending' | 'completed';
  completedAt?: string;
  shortfall?: number;
  provider?: string;
};

@Injectable()
export class PayrollFloatTopupService {
  private readonly logger = new Logger(PayrollFloatTopupService.name);

  constructor(
    private readonly payrollRunRepository: PayrollRunRepository,
    private readonly balanceService: PayrollFloatBalanceService,
    private readonly paymentFactory: PaymentProviderFactoryService,
    private readonly paymentOrchestrator: PayrollPaymentOrchestrator,
    private readonly tenantSettingsService: TenantSettingsService,
    private readonly payrollFeeService: PayrollFeeService,
    private readonly bachsApi: BachsApiService,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  async preflight(payrollRunId: string, tenantId: string): Promise<PayrollFundPreflight> {
    if (!isPayrollGatewayEnabled()) {
      throw new BadRequestException(
        'Payroll gateway is not configured. Configure Nomba/Monnify/Fincra/Bachs (NGN) and/or Noah/Fincra/Bachs credentials.',
      );
    }

    const run = await this.requireApprovedRun(payrollRunId, tenantId);
    const bachsPreflight = await this.tryBachsFundingPreflight(run, tenantId);
    if (bachsPreflight) return bachsPreflight;

    const currency = run.baseCurrency.toUpperCase();
    const provider = resolvePaymentProvider(currency);
    const requiredAmount = this.payableNet(run);
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
          message: `${providerLabel} balance already covers this payroll run.`,
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
          ? `Your company needs to fund ${shortfall} ${currency} via checkout. We then pay employees automatically via ${providerLabel}.`
          : `Your company needs to fund ${shortfall} ${currency} in the ${providerLabel} dashboard, then retry.`,
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
        ? `Could not read provider balance. Checkout will fund ${requiredAmount} ${currency}, then payout starts automatically.`
        : `${balance.reason} Open ${dashboardUrl || 'the provider dashboard'}, fund at least ${requiredAmount} ${currency}, then retry.`,
    };
  }

  /**
   * Hosted checkout providers: company funds the run (Bachs quotes mixed currencies into
   * one checkout + Paqad fee), webhook then auto-pays each employee’s payment method.
   * Other providers: pay from balance when covered; otherwise error with dashboard guidance.
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
      const feeNote =
        preflight.platformFee != null && preflight.platformFee > 0
          ? ` (includes ${preflight.platformFee} ${preflight.currency} Paqad fee)`
          : '';
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

    const expected = Number(meta.shortfall ?? input.amount ?? 0);
    const verifiedAmount = Number(verified.amount ?? 0);
    const rawPaid =
      Number.isFinite(verifiedAmount) && verifiedAmount > 0
        ? verifiedAmount
        : Number.isFinite(Number(input.amount)) && Number(input.amount) > 0
          ? Number(input.amount)
          : verifiedAmount;
    const paidAmount = normalizeWebhookAmount(
      rawPaid,
      expected > 0 ? expected : rawPaid,
      run.baseCurrency,
    );
    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      this.logger.warn(`Payroll float top-up invalid amount for ${input.orderReference}`);
      return { received: true, paid: false };
    }
    if (expected > 0 && paidAmount + BILLING_AMOUNT_TOLERANCE < expected) {
      this.logger.warn(
        `Payroll float top-up underpaid for ${input.orderReference}: expected ${expected}, got ${paidAmount}`,
      );
      return { received: true, paid: false };
    }
    // Reject wildly inflated provider amounts (wrong-currency / adaptive FX mismatch).
    if (expected > 0 && paidAmount > expected * 10) {
      this.logger.warn(
        `Payroll float top-up amount mismatch for ${input.orderReference}: expected ${expected}, got ${paidAmount}`,
      );
      return { received: true, paid: false };
    }

    const claimed = await this.claimFloatTopupCompleted({
      runId: run.id,
      tenantId: run.tenantId,
      orderReference: input.orderReference,
      shortfall: meta.shortfall,
      provider,
    });
    if (!claimed) {
      return { received: true, paid: true };
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

    const fundingCurrency = pickBachsFundingCurrency(fundingItems, getBachsPayoutSourceCurrency());
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
      const balance = await this.balanceService.getAvailableBalance(
        PaymentProvider.BACHS,
        fundingCurrency,
      );
      const available = balance.supported ? balance.available : null;
      const shortfall =
        available == null
          ? fee.checkoutTotal
          : Math.max(0, Math.round((fee.checkoutTotal - available) * 100) / 100);
      const canCheckout = this.balanceService.supportsHostedFloatTopup(PaymentProvider.BACHS);

      if (shortfall <= 0 && available != null) {
        return {
          ok: true,
          provider: PaymentProvider.BACHS,
          currency: fundingCurrency,
          requiredAmount: fee.checkoutTotal,
          availableBalance: available,
          shortfall: 0,
          balanceSupported: true,
          canCheckout,
          dashboardUrl: '',
          message: 'Bachs balance already covers this payroll run (including Paqad fee).',
          employeeTotal: fee.employeeTotal,
          platformFee: fee.platformFee,
          feePercentage: fee.feePercentage,
        };
      }

      return {
        ok: false,
        provider: PaymentProvider.BACHS,
        currency: fundingCurrency,
        requiredAmount: fee.checkoutTotal,
        availableBalance: available,
        shortfall,
        balanceSupported: balance.supported,
        canCheckout,
        dashboardUrl: '',
        message: canCheckout
          ? `Your company pays ${fee.checkoutTotal} ${fundingCurrency} in one checkout (${fee.employeeTotal} employee pay + ${fee.platformFee} Paqad fee at ${fee.feePercentage}%). We then route each salary via Bachs.`
          : `Fund ${fee.checkoutTotal} ${fundingCurrency} on Bachs, then retry.`,
        employeeTotal: fee.employeeTotal,
        platformFee: fee.platformFee,
        feePercentage: fee.feePercentage,
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
      .andWhere(`(run.metadata::jsonb -> 'floatTopup' ->> 'orderReference') = :ref`, {
        ref: input.orderReference,
      })
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
