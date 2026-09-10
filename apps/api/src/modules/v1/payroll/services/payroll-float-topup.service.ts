import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';
import { PayrollStatus } from 'src/common/enums/payroll-status.enum';
import type { AuditContext } from 'src/common/interfaces/audit-context.interface';
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
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  async preflight(payrollRunId: string, tenantId: string): Promise<PayrollFundPreflight> {
    if (!isPayrollGatewayEnabled()) {
      throw new BadRequestException(
        'Payroll gateway is not configured. Configure Nomba/Monnify/Fincra (NGN) and/or Noah/Fincra credentials.',
      );
    }

    const run = await this.requireApprovedRun(payrollRunId, tenantId);
    const currency = run.baseCurrency.toUpperCase();
    const provider = resolvePaymentProvider(currency);
    const requiredAmount = this.payableNet(run);
    const dashboardUrl = this.balanceService.providerDashboardUrl(provider);
    const canCheckout = this.balanceService.supportsHostedFloatTopup(provider);

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
          message: 'Provider float covers this payroll run.',
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
          ? `Provider float is short by ${shortfall} ${currency}. Fund via checkout, then payout starts automatically.`
          : `Provider float is short by ${shortfall} ${currency}. Fund in the provider dashboard, then retry.`,
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
   * If float is enough → pay now.
   * If short and hosted top-up exists → return checkout URL (webhook auto-pays).
   * Otherwise → hard error with dashboard guidance.
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
    if (preflight.ok) {
      const result = await this.paymentOrchestrator.payNowPayroll(
        payrollRunId,
        tenantId,
        auditContext,
      );
      return { action: 'paid', result };
    }

    if (!preflight.canCheckout || preflight.shortfall <= 0) {
      throw new BadRequestException(preflight.message);
    }

    const checkout = await this.createFloatTopupCheckout(
      payrollRunId,
      tenantId,
      auditContext.performedById,
      preflight,
    );
    return {
      action: 'checkout',
      checkoutUrl: checkout.checkoutUrl,
      orderReference: checkout.orderReference,
      preflight,
    };
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
    if (meta.status === 'completed' && meta.orderReference === input.orderReference) {
      return { received: true, paid: true };
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
      if (meta.status === 'completed' && meta.orderReference === input.orderReference) {
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
