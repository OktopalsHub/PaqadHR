import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { BachsApiService } from 'src/common/services/bachs-api.service';
import { PaymentProviderFactoryService } from 'src/common/services/payment-provider-factory.service';
import { DEFAULT_WALLET_CURRENCY_FALLBACK } from 'src/common/utils/rewards-defaults.util';
import { tenantFrontendUrl } from 'src/common/utils/tenant-frontend-url.util';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ZeptomailEmailService } from '../../notifications/services/zeptomail-email.service';
import { escapeHtml } from '../../notifications/templates/brand';
import { BILLING_AMOUNT_TOLERANCE } from '../../subscriptions/constants/billing.constants';
import { TenantSubscription } from '../../subscriptions/entities/tenant-subscription.entity';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';
import { normalizeWebhookAmount } from '../../subscriptions/utils/per-seat-pricing.util';
import { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { resolveRewardsWalletPaymentProvider } from '../config/rewards-wallet-provider.config';
import { WALLET_TOPUP_MAX_AMOUNT } from '../constants/wallet.constants';
import {
  WALLET_CHARGE_FAILED_ADMIN,
  WALLET_CHECKOUT_UNAVAILABLE,
  WALLET_CREDIT_FAILED,
  WALLET_NO_BILLING_CARD,
  WALLET_UNAVAILABLE_MEMBER,
} from '../constants/wallet-error-messages';
import { TenantWallet } from '../entities/tenant-wallet.entity';
import { TenantWalletTransaction } from '../entities/tenant-wallet-transaction.entity';
import { resolveCheckoutCustomerFullName } from '../utils/checkout-customer-name.util';
import {
  buildWalletTopupOrderRef,
  resolveWalletTopupProviderFromOrderRef,
} from '../utils/wallet-order-ref.util';
import { SavedCardChargePendingError, SavedCardChargeService } from './saved-card-charge.service';
import { TenantWalletService } from './tenant-wallet.service';

type ChargeAudience = 'member' | 'admin';

@Injectable()
export class TenantWalletTopupService {
  private readonly logger = new Logger(TenantWalletTopupService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly walletService: TenantWalletService,
    private readonly factory: PaymentProviderFactoryService,
    private readonly bachsApi: BachsApiService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly emailService: ZeptomailEmailService,
    private readonly savedCardCharge: SavedCardChargeService,
    private readonly tenantSettingsService: TenantSettingsService,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(TenantSubscription)
    private readonly subscriptionRepository: Repository<TenantSubscription>,
  ) {}

  async manualTopup(
    tenantId: string,
    amount: number,
    initiatedByMemberId: string,
  ): Promise<TenantWallet> {
    const wallet = await this.walletService.ensureWallet(tenantId);
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    const provider = resolveRewardsWalletPaymentProvider(tenant?.countryCode, wallet.currencyCode);
    const reference =
      provider === PaymentProvider.MONNIFY || provider === PaymentProvider.BACHS
        ? buildWalletTopupOrderRef(provider, tenantId)
        : `manual-topup-${randomUUID()}`;
    return this.chargeAndCredit(
      tenantId,
      amount,
      reference,
      'Manual rewards wallet top-up via saved payment method',
      undefined,
      'admin',
      initiatedByMemberId,
    );
  }

  async createTopupCheckout(
    tenantId: string,
    amount: number,
    initiatedByMemberId: string,
  ): Promise<{ checkoutUrl: string; orderReference: string; transactionReference?: string }> {
    this.assertTopupAmount(amount);
    const actorMemberId = this.requireInitiatingTenantMemberId(initiatedByMemberId);

    const customerEmail = await this.resolveBillingEmail(tenantId);
    if (!customerEmail) {
      throw new BadRequestException(
        'Billing contact email is not configured. Add it in Settings → Billing.',
      );
    }

    const wallet = await this.walletService.ensureWallet(tenantId);
    const currency = (wallet.currencyCode || DEFAULT_WALLET_CURRENCY_FALLBACK).toUpperCase();
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    const provider = resolveRewardsWalletPaymentProvider(tenant?.countryCode, currency);

    const adapter = this.factory.resolveCheckoutAdapter(provider);
    if (!adapter?.isConfigured()) {
      throw new BadRequestException(WALLET_CHECKOUT_UNAVAILABLE);
    }

    if (provider === PaymentProvider.MONNIFY && currency !== 'NGN') {
      throw new BadRequestException(WALLET_CHECKOUT_UNAVAILABLE);
    }

    if (provider === PaymentProvider.BACHS && currency !== 'NGN' && currency !== 'USD') {
      throw new BadRequestException(WALLET_CHECKOUT_UNAVAILABLE);
    }

    const callbackUrl = tenant?.slug
      ? tenantFrontendUrl(tenant.slug, '/settings?tab=rewards&wallet_topup=done')
      : tenantFrontendUrl('', '/settings?tab=rewards&wallet_topup=done');

    const orderReference = buildWalletTopupOrderRef(provider, tenantId);
    const customerName = resolveCheckoutCustomerFullName(tenant?.name, customerEmail);

    let bachsCustomerId: string | undefined;
    if (provider === PaymentProvider.BACHS) {
      const existingSub = await this.subscriptionRepository.findOne({ where: { tenantId } });
      const stored = existingSub?.usageMetrics?.bachsCustomerId?.trim();
      if (stored?.startsWith('cust_')) {
        bachsCustomerId = stored;
      } else {
        const customer = await this.bachsApi.findOrCreateCustomer({
          email: customerEmail,
          name: customerName,
          tenantId,
        });
        bachsCustomerId = customer.customer_id;
        await this.persistBachsCustomerId(tenantId, bachsCustomerId);
      }
    }

    const result = await adapter.createCheckout({
      orderReference,
      customerEmail,
      amount,
      currency,
      callbackUrl,
      customerName,
      meta: {
        tenantId,
        billingType: 'wallet_topup',
        expectedAmount: String(amount),
        initiatedByMemberId: actorMemberId,
      },
      ...(bachsCustomerId ? { bachsCustomerId, savePaymentMethod: true } : {}),
    });

    return {
      checkoutUrl: result.checkoutLink,
      orderReference: result.orderReference,
      ...(result.transactionReference ? { transactionReference: result.transactionReference } : {}),
    };
  }

  async completeCheckoutTopup(
    input: {
      tenantId: string;
      orderReference: string;
      amount?: number;
      transactionReference?: string;
      initiatedByMemberId?: string;
    },
    billingProvider: PaymentProvider = PaymentProvider.NOMBA,
  ): Promise<{ received: boolean; credited: boolean; retryable?: boolean }> {
    const existing = await this.dataSource.getRepository(TenantWalletTransaction).findOne({
      where: { reference: input.orderReference },
      select: ['id', 'type'],
    });
    if (existing) {
      if (existing.type === 'DEPOSIT') {
        await this.clearBachsPendingCharge(input.tenantId, input.orderReference);
      }
      return { received: true, credited: existing.type === 'DEPOSIT' };
    }

    // Prefixed order refs must belong to this tenant (BOLA).
    if (
      /^(wm|wt|nw|wb|wf)_/i.test(input.orderReference) &&
      !resolveWalletTopupProviderFromOrderRef(input.orderReference, input.tenantId)
    ) {
      return { received: true, credited: false };
    }

    const wallet = await this.walletService.ensureWallet(input.tenantId);
    const currency = (wallet.currencyCode || DEFAULT_WALLET_CURRENCY_FALLBACK).toUpperCase();

    const adapter = this.factory.resolveCheckoutAdapter(billingProvider);
    const verified = adapter
      ? await adapter.verifyCheckout({
          orderReference: input.orderReference,
          transactionReference: input.transactionReference,
        })
      : null;

    const status = verified?.status?.toLowerCase() ?? '';
    if (
      status !== 'success' &&
      status !== 'successful' &&
      status !== 'succeeded' &&
      status !== 'accepted' &&
      status !== 'payment_successful' &&
      status !== 'payment successful'
    ) {
      this.logger.warn(
        `Wallet checkout top-up not yet successful for ${input.orderReference}: ${status || 'unknown'}`,
      );
      return { received: true, credited: false, retryable: true };
    }

    const expected = input.amount ?? Number(verified?.amount ?? 0);
    const verifiedAmount = Number(verified?.amount ?? 0);
    const rawPaid =
      Number.isFinite(verifiedAmount) && verifiedAmount > 0
        ? verifiedAmount
        : Number.isFinite(expected) && expected > 0
          ? expected
          : verifiedAmount;
    const paid = normalizeWebhookAmount(rawPaid, expected > 0 ? expected : rawPaid, currency);
    if (!Number.isFinite(paid) || paid <= 0) {
      this.logger.warn(`Wallet checkout top-up invalid amount for ${input.orderReference}`);
      return { received: true, credited: false };
    }

    // Credit the requested wallet amount only. Never trust a larger provider figure
    // (adaptive FX / wrong-currency major units).
    let creditAmount = paid;
    if (input.amount && Number.isFinite(input.amount) && input.amount > 0) {
      if (paid + BILLING_AMOUNT_TOLERANCE < input.amount) {
        this.logger.warn(
          `Wallet checkout top-up underpaid for ${input.orderReference}: expected ${input.amount}, got ${paid}`,
        );
        return { received: true, credited: false, retryable: false };
      }
      creditAmount = Math.min(paid, input.amount);
    }

    return this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(TenantWallet)
        .createQueryBuilder('w')
        .setLock('pessimistic_write')
        .where('w.tenantId = :tenantId', { tenantId: input.tenantId })
        .getOneOrFail();

      const dup = await manager.getRepository(TenantWalletTransaction).findOne({
        where: { reference: input.orderReference },
        select: ['id'],
      });
      if (dup) {
        await this.clearBachsPendingCharge(input.tenantId, input.orderReference);
        return { received: true, credited: false };
      }

      const actorMemberId = this.resolveCheckoutActorMemberId(input, verified ?? null);
      if (!actorMemberId) {
        throw new BadRequestException('A tenant member is required to credit the wallet');
      }

      await this.walletService.credit(
        input.tenantId,
        creditAmount,
        'DEPOSIT',
        input.orderReference,
        'Rewards wallet top-up via checkout',
        manager,
        {
          providerEventId: input.orderReference,
          actorMemberId,
        },
      );

      if (verified?.cardToken?.trim()) {
        await this.persistMonnifyWalletCard(input.tenantId, {
          cardToken: verified.cardToken.trim(),
          customerEmail: verified.customerEmail,
          cardLastFour: verified.cardLastFour,
          cardBrand: verified.cardBrand,
        });
      }

      await this.clearBachsPendingCharge(input.tenantId, input.orderReference);

      this.logger.log(
        `Credited wallet ${input.tenantId} for checkout top-up ${input.orderReference}`,
      );
      return { received: true, credited: true };
    });
  }

  async persistBachsSavedPaymentMethod(input: {
    customerId: string;
    paymentMethodId: string;
    tenantId?: string;
    cardBrand?: string;
    cardLastFour?: string;
  }): Promise<{ received: boolean; matched: boolean }> {
    const customerId = input.customerId.trim();
    const paymentMethodId = input.paymentMethodId.trim();
    if (!customerId.startsWith('cust_') || !paymentMethodId.startsWith('pm_')) {
      return { received: true, matched: false };
    }

    const matches = await this.subscriptionRepository
      .createQueryBuilder('sub')
      .where(`sub.usage_metrics->>'bachsCustomerId' = :customerId`, { customerId })
      .getMany();

    const scopedTenantId = input.tenantId?.trim();
    let sub: TenantSubscription | undefined;
    if (scopedTenantId) {
      sub = matches.find((row) => row.tenantId === scopedTenantId);
    } else if (matches.length > 1) {
      this.logger.warn(
        `Refusing Bachs payment_method.saved for customer ${customerId}: ${matches.length} tenants share this customer id`,
      );
      return { received: true, matched: false };
    } else {
      sub = matches[0];
    }

    if (!sub) {
      this.logger.debug(`No subscription for Bachs customer ${customerId}`);
      return { received: true, matched: false };
    }

    // Wallet cards live in usageMetrics so they never overwrite subscription renewals.
    sub.usageMetrics = {
      ...(sub.usageMetrics ?? {}),
      bachsCustomerId: customerId,
      bachsPaymentMethodId: paymentMethodId,
    };
    await this.subscriptionRepository.save(sub);
    return { received: true, matched: true };
  }

  async maybeAutoTopupAfterDebit(tenantId: string, actorMemberId: string): Promise<void> {
    const wallet = await this.dataSource
      .getRepository(TenantWallet)
      .findOneOrFail({ where: { tenantId } });
    if (
      !wallet.autoTopupEnabled ||
      Number(wallet.autoTopupAmount) <= 0 ||
      Number(wallet.balanceAmount) > Number(wallet.autoTopupThreshold)
    ) {
      return;
    }

    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    const walletProvider = resolveRewardsWalletPaymentProvider(
      tenant?.countryCode,
      wallet.currencyCode,
    );
    if (walletProvider === PaymentProvider.FINCRA) {
      this.logger.debug(
        `Skipping auto-topup for tenant ${tenantId}: saved-card top-up is unavailable on ${walletProvider}`,
      );
      return;
    }

    const chargeReference =
      walletProvider === PaymentProvider.MONNIFY || walletProvider === PaymentProvider.BACHS
        ? buildWalletTopupOrderRef(walletProvider, tenantId)
        : `auto-topup-${randomUUID()}`;

    await this.chargeAndCredit(
      tenantId,
      Number(wallet.autoTopupAmount),
      chargeReference,
      `Automatic replenishment of rewards wallet (balance below ${wallet.autoTopupThreshold})`,
      undefined,
      'member',
      this.requireInitiatingTenantMemberId(actorMemberId),
    );
  }

  private async chargeAndCredit(
    tenantId: string,
    amount: number,
    reference: string,
    description: string,
    manager: EntityManager | undefined,
    audience: ChargeAudience,
    actorMemberId: string,
  ): Promise<TenantWallet> {
    const initiatingMemberId = this.requireInitiatingTenantMemberId(actorMemberId);
    this.assertTopupAmount(amount);

    const wallet = await this.walletService.ensureWallet(tenantId, manager);
    const currency = (wallet.currencyCode || DEFAULT_WALLET_CURRENCY_FALLBACK).toUpperCase();
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    const provider = resolveRewardsWalletPaymentProvider(tenant?.countryCode, currency);

    const subscription = await this.subscriptionsService.getTenantSubscription(tenantId);
    const metrics = subscription?.usageMetrics;
    const monnifyCardToken = metrics?.monnifyWalletCardToken?.trim();
    const monnifyCardEmail = metrics?.monnifyWalletCardEmail?.trim();
    const bachsCustomerId = metrics?.bachsCustomerId?.trim();
    const bachsPaymentMethodId = metrics?.bachsPaymentMethodId?.trim();
    // Pick only the active wallet provider's card — never prefer a stale Monnify token over Bachs.
    const tokenKey =
      provider === PaymentProvider.BACHS
        ? bachsPaymentMethodId
        : provider === PaymentProvider.MONNIFY
          ? monnifyCardToken
          : subscription?.paymentMethodId?.trim();
    if (!tokenKey) {
      throw new BadRequestException(
        audience === 'admin' ? WALLET_NO_BILLING_CARD : WALLET_UNAVAILABLE_MEMBER,
      );
    }

    let customerEmail: string;
    try {
      const resolved = monnifyCardEmail || (await this.resolveBillingEmail(tenantId));
      if (!resolved) throw new Error('Billing contact email is not configured');
      customerEmail = resolved;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.notifyWalletChargeFailed(tenantId, amount, DEFAULT_WALLET_CURRENCY_FALLBACK, reason);
      throw new BadRequestException(
        audience === 'admin' ? WALLET_CHARGE_FAILED_ADMIN : WALLET_UNAVAILABLE_MEMBER,
      );
    }

    this.savedCardCharge.assertProviderAvailable(
      provider,
      monnifyCardToken,
      tokenKey,
      audience,
      bachsCustomerId,
    );

    // Reuse an in-flight Bachs charge so retries don't create a second payment.
    // Drop a stale pending ref if the webhook already credited it.
    let pendingBachsRef =
      provider === PaymentProvider.BACHS
        ? metrics?.bachsPendingWalletChargeRef?.trim() || undefined
        : undefined;
    if (pendingBachsRef) {
      const alreadyPaid = await this.dataSource.getRepository(TenantWalletTransaction).findOne({
        where: { reference: pendingBachsRef },
        select: ['id', 'type'],
      });
      if (alreadyPaid?.type === 'DEPOSIT') {
        await this.clearBachsPendingCharge(tenantId, pendingBachsRef);
        pendingBachsRef = undefined;
      }
    }
    const chargeOrderRef = pendingBachsRef || reference;

    let chargeReference: string;
    try {
      chargeReference = await this.savedCardCharge.executeCharge(
        provider,
        tenantId,
        amount,
        currency,
        customerEmail,
        chargeOrderRef,
        description,
        initiatingMemberId,
        tokenKey,
        monnifyCardToken,
        bachsCustomerId,
      );
    } catch (error) {
      if (error instanceof SavedCardChargePendingError) {
        const keptPending = await this.persistBachsPendingCharge(tenantId, error.reference);
        if (!keptPending) {
          // Webhook credited while we were polling — do not leave a stale pending ref.
          return this.walletService.ensureWallet(tenantId, manager);
        }
        this.logger.log(
          `Bachs charge ${error.reference} still processing for tenant ${tenantId}; webhook will credit`,
        );
        return wallet;
      }
      if (provider === PaymentProvider.BACHS && pendingBachsRef) {
        await this.clearBachsPendingCharge(tenantId, pendingBachsRef);
      }
      const reason = error instanceof Error ? error.message : String(error);
      this.notifyWalletChargeFailed(tenantId, amount, currency, reason);
      throw new BadRequestException(
        audience === 'admin' ? WALLET_CHARGE_FAILED_ADMIN : WALLET_UNAVAILABLE_MEMBER,
      );
    }

    try {
      const credited = await this.walletService.credit(
        tenantId,
        amount,
        'DEPOSIT',
        chargeOrderRef,
        description,
        manager,
        { providerEventId: chargeReference, actorMemberId: initiatingMemberId },
      );
      if (provider === PaymentProvider.BACHS) {
        await this.clearBachsPendingCharge(tenantId, chargeOrderRef);
      }
      return credited;
    } catch (error) {
      this.logger.error(
        `CRITICAL: Payment charged (${chargeReference}) but wallet credit failed for tenant ${tenantId}: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException(WALLET_CREDIT_FAILED);
    }
  }

  /**
   * Persist a pending Bachs charge ref only when that payment has not already been credited.
   * Returns false when the deposit already exists (caller must not treat it as still pending).
   */
  private async persistBachsPendingCharge(tenantId: string, reference: string): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const credited = await manager.getRepository(TenantWalletTransaction).findOne({
        where: { reference },
        select: ['id', 'type'],
      });
      if (credited?.type === 'DEPOSIT') {
        const sub = await manager
          .getRepository(TenantSubscription)
          .createQueryBuilder('sub')
          .setLock('pessimistic_write')
          .where('sub.tenantId = :tenantId', { tenantId })
          .getOne();
        if (sub?.usageMetrics?.bachsPendingWalletChargeRef === reference) {
          sub.usageMetrics = {
            ...(sub.usageMetrics ?? {}),
            bachsPendingWalletChargeRef: undefined,
          };
          await manager.save(sub);
        }
        return false;
      }

      const sub = await manager
        .getRepository(TenantSubscription)
        .createQueryBuilder('sub')
        .setLock('pessimistic_write')
        .where('sub.tenantId = :tenantId', { tenantId })
        .getOne();
      if (!sub) return false;

      // Re-check after lock — webhook may have credited between the first read and the lock.
      const creditedAfterLock = await manager.getRepository(TenantWalletTransaction).findOne({
        where: { reference },
        select: ['id'],
      });
      if (creditedAfterLock) {
        if (sub.usageMetrics?.bachsPendingWalletChargeRef === reference) {
          sub.usageMetrics = {
            ...(sub.usageMetrics ?? {}),
            bachsPendingWalletChargeRef: undefined,
          };
          await manager.save(sub);
        }
        return false;
      }

      if (sub.usageMetrics?.bachsPendingWalletChargeRef === reference) return true;
      sub.usageMetrics = {
        ...(sub.usageMetrics ?? {}),
        bachsPendingWalletChargeRef: reference,
      };
      await manager.save(sub);
      return true;
    });
  }

  private async clearBachsPendingCharge(tenantId: string, reference?: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const sub = await manager
        .getRepository(TenantSubscription)
        .createQueryBuilder('sub')
        .setLock('pessimistic_write')
        .where('sub.tenantId = :tenantId', { tenantId })
        .getOne();
      const pending = sub?.usageMetrics?.bachsPendingWalletChargeRef?.trim();
      if (!sub || !pending) return;
      if (reference && pending !== reference) return;
      sub.usageMetrics = {
        ...(sub.usageMetrics ?? {}),
        bachsPendingWalletChargeRef: undefined,
      };
      await manager.save(sub);
    });
  }

  private async resolveBillingEmail(tenantId: string): Promise<string | null> {
    try {
      const settings = await this.tenantSettingsService.getTenantSettings(tenantId);
      const contactEmail = settings.settings.billing?.contactEmail?.trim();
      if (contactEmail) return contactEmail;
    } catch {
      // Fall through to owner email.
    }
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
      relations: ['createdBy'],
      select: {
        id: true,
        createdBy: {
          id: true,
          email: true,
        },
      },
    });
    return tenant?.createdBy?.email?.trim() ?? null;
  }

  private async persistBachsCustomerId(tenantId: string, customerId: string): Promise<void> {
    const sub = await this.subscriptionRepository.findOne({ where: { tenantId } });
    if (!sub) return;
    if (sub.usageMetrics?.bachsCustomerId === customerId) return;
    sub.usageMetrics = { ...(sub.usageMetrics ?? {}), bachsCustomerId: customerId };
    await this.subscriptionRepository.save(sub);
  }

  private async persistMonnifyWalletCard(
    tenantId: string,
    card: {
      cardToken: string;
      customerEmail?: string;
      cardLastFour?: string;
      cardBrand?: string;
    },
  ): Promise<void> {
    const sub = await this.subscriptionRepository.findOne({ where: { tenantId } });
    if (!sub) return;
    sub.usageMetrics = {
      ...(sub.usageMetrics ?? {}),
      monnifyWalletCardToken: card.cardToken,
      ...(card.customerEmail?.trim() ? { monnifyWalletCardEmail: card.customerEmail.trim() } : {}),
    };
    if (card.cardBrand?.trim()) sub.paymentMethodBrand = card.cardBrand.trim();
    if (card.cardLastFour?.trim()) {
      sub.paymentMethodLastFour = card.cardLastFour.trim().slice(-4);
    }
    await this.subscriptionRepository.save(sub);
  }

  private resolveCheckoutActorMemberId(
    input: { initiatedByMemberId?: string },
    verified: { metaData?: Record<string, unknown> } | Record<string, unknown> | null,
  ): string | undefined {
    const fromInput = input.initiatedByMemberId?.trim();
    if (fromInput) return fromInput;
    const meta =
      verified && 'metaData' in verified
        ? (verified.metaData as Record<string, unknown> | undefined)
        : undefined;
    const fromMeta = meta?.initiatedByMemberId;
    if (typeof fromMeta === 'string' && fromMeta.trim()) return fromMeta.trim();
    return undefined;
  }

  private requireInitiatingTenantMemberId(memberId?: string | null): string {
    const id = memberId?.trim();
    if (!id) {
      throw new BadRequestException('A tenant member is required to credit the wallet');
    }
    return id;
  }

  private assertTopupAmount(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Top up amount must be greater than 0');
    }
    if (amount > WALLET_TOPUP_MAX_AMOUNT) {
      throw new BadRequestException(`Top up amount cannot exceed ${WALLET_TOPUP_MAX_AMOUNT}`);
    }
  }

  private notifyWalletChargeFailed(
    tenantId: string,
    amount: number,
    currency: string,
    reason: string,
  ): void {
    void this.sendWalletChargeFailedEmail(tenantId, amount, currency, reason).catch((err) => {
      this.logger.warn(
        `Failed to send wallet charge failure email for tenant ${tenantId}: ${err instanceof Error ? err.message : err}`,
      );
    });
  }

  private async sendWalletChargeFailedEmail(
    tenantId: string,
    amount: number,
    currency: string,
    reason: string,
  ): Promise<void> {
    const email = await this.resolveBillingEmail(tenantId);
    if (!email) return;
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
      select: ['id', 'name', 'slug'],
    });
    const settingsUrl = tenant?.slug
      ? tenantFrontendUrl(tenant.slug, '/settings?tab=rewards')
      : tenantFrontendUrl('', '/settings?tab=rewards');
    await this.emailService.sendEmail({
      to: email,
      subject: 'Paqad: Rewards wallet payment failed',
      text: [
        `A rewards wallet payment failed for ${tenant?.name ?? 'your workspace'}.`,
        `Amount: ${currency} ${amount.toLocaleString()}`,
        `Reason: ${reason}`,
        `Top up via checkout in Rewards settings: ${settingsUrl}`,
      ].join('\n'),
      html: `<p>A rewards wallet payment failed for <strong>${escapeHtml(tenant?.name ?? 'your workspace')}</strong>.</p>
<p>Amount: <strong>${escapeHtml(currency)} ${escapeHtml(amount.toLocaleString())}</strong></p>
<p>Reason: ${escapeHtml(reason)}</p>
<p><a href="${escapeHtml(settingsUrl)}">Open Rewards settings</a></p>`,
    });
  }
}
