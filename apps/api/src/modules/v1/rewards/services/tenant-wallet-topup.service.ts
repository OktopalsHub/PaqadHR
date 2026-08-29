import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isBachsWalletTopupConfigured } from 'src/common/config/bachs.config';
import { isNoahConfigured } from 'src/common/config/noah.config';
import { isNoahPaymentVerified } from 'src/common/config/noah-api.util';
import { isNombaConfigured } from 'src/common/config/nomba.config';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { BachsApiService } from 'src/common/services/bachs-api.service';
import { FincraApiService } from 'src/common/services/fincra-api.service';
import { MonnifyApiService } from 'src/common/services/monnify-api.service';
import { NoahApiService } from 'src/common/services/noah-api.service';
import { DEFAULT_WALLET_CURRENCY_FALLBACK } from 'src/common/utils/rewards-defaults.util';
import { tenantFrontendUrl } from 'src/common/utils/tenant-frontend-url.util';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ZeptomailEmailService } from '../../notifications/services/zeptomail-email.service';
import { BILLING_AMOUNT_TOLERANCE } from '../../subscriptions/constants/billing.constants';
import { TenantSubscription } from '../../subscriptions/entities/tenant-subscription.entity';
import { NombaApiService } from '../../subscriptions/services/nomba-api.service';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';
import {
  isAmountWithinTolerance,
  normalizeWebhookAmount,
} from '../../subscriptions/utils/per-seat-pricing.util';
import { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { resolveRewardsWalletPaymentProvider } from '../config/rewards-wallet-provider.config';
import { WALLET_TOPUP_MAX_AMOUNT } from '../constants/wallet.constants';
import {
  WALLET_CHARGE_FAILED_ADMIN,
  WALLET_CHECKOUT_UNAVAILABLE,
  WALLET_CREDIT_FAILED,
  WALLET_NO_BILLING_CARD,
  WALLET_SAVED_CARD_UNSUPPORTED,
  WALLET_UNAVAILABLE_MEMBER,
} from '../constants/wallet-error-messages';
import { TenantWallet } from '../entities/tenant-wallet.entity';
import { TenantWalletTransaction } from '../entities/tenant-wallet-transaction.entity';
import {
  buildBachsWalletTopupOrderRef,
  buildFincraWalletTopupOrderRef,
  buildMonnifyWalletTopupOrderRef,
  buildNoahWalletTopupOrderRef,
  buildNombaWalletTopupOrderRef,
  isBachsWalletTopupOrderRef,
  isFincraWalletTopupOrderRef,
  isMonnifyWalletTopupOrderRef,
  isNoahWalletTopupOrderRef,
  isNombaWalletTopupOrderRef,
} from '../utils/wallet-order-ref.util';
import { TenantWalletService } from './tenant-wallet.service';

type ChargeAudience = 'member' | 'admin';

@Injectable()
export class TenantWalletTopupService {
  private readonly logger = new Logger(TenantWalletTopupService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly walletService: TenantWalletService,
    private readonly nombaApi: NombaApiService,
    private readonly monnifyApi: MonnifyApiService,
    private readonly noahApi: NoahApiService,
    private readonly fincraApi: FincraApiService,
    private readonly bachsApi: BachsApiService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly tenantSettingsService: TenantSettingsService,
    private readonly emailService: ZeptomailEmailService,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
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
      provider === PaymentProvider.MONNIFY
        ? buildMonnifyWalletTopupOrderRef(tenantId)
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

    if (provider === PaymentProvider.NOMBA && !this.nombaApi.isConfigured()) {
      throw new BadRequestException(WALLET_CHECKOUT_UNAVAILABLE);
    }
    if (provider === PaymentProvider.MONNIFY && !this.monnifyApi.isConfigured()) {
      throw new BadRequestException(WALLET_CHECKOUT_UNAVAILABLE);
    }
    if (provider === PaymentProvider.MONNIFY && currency !== 'NGN') {
      throw new BadRequestException(WALLET_CHECKOUT_UNAVAILABLE);
    }
    if (provider === PaymentProvider.NOAH && !this.noahApi.isConfigured()) {
      throw new BadRequestException(WALLET_CHECKOUT_UNAVAILABLE);
    }
    if (provider === PaymentProvider.FINCRA && !this.fincraApi.isCheckoutConfigured()) {
      throw new BadRequestException(WALLET_CHECKOUT_UNAVAILABLE);
    }
    if (provider === PaymentProvider.BACHS) {
      if (
        !this.bachsApi.isConfigured() ||
        !isBachsWalletTopupConfigured(currency as 'NGN' | 'USD')
      ) {
        throw new BadRequestException(WALLET_CHECKOUT_UNAVAILABLE);
      }
      if (currency !== 'NGN' && currency !== 'USD') {
        throw new BadRequestException(WALLET_CHECKOUT_UNAVAILABLE);
      }
    }

    const callbackUrl = tenant?.slug
      ? tenantFrontendUrl(tenant.slug, '/settings?tab=rewards&wallet_topup=done')
      : tenantFrontendUrl('', '/settings?tab=rewards&wallet_topup=done');

    const orderReference =
      provider === PaymentProvider.NOMBA
        ? buildNombaWalletTopupOrderRef(tenantId)
        : provider === PaymentProvider.MONNIFY
          ? buildMonnifyWalletTopupOrderRef(tenantId)
          : provider === PaymentProvider.BACHS
            ? buildBachsWalletTopupOrderRef(tenantId)
            : provider === PaymentProvider.FINCRA
              ? buildFincraWalletTopupOrderRef(tenantId)
              : buildNoahWalletTopupOrderRef(tenantId);

    const meta = {
      tenantId,
      billingType: 'wallet_topup',
      expectedAmount: String(amount),
      initiatedByMemberId: actorMemberId,
    };

    const checkoutCurrency = provider === PaymentProvider.MONNIFY ? 'NGN' : currency;

    const result =
      provider === PaymentProvider.NOMBA
        ? await this.nombaApi
            .createCheckoutOrder({
              orderReference,
              customerEmail,
              amount,
              currency,
              callbackUrl,
              tokenizeCard: false,
              meta,
            })
            .then((session) => ({
              checkoutLink: session.checkoutLink,
              orderReference: session.orderReference,
              transactionReference: undefined as string | undefined,
            }))
        : provider === PaymentProvider.MONNIFY
          ? await this.monnifyApi
              .initializeTransaction({
                amount,
                customerEmail,
                customerName: customerEmail.split('@')[0] || 'Customer',
                paymentReference: orderReference,
                paymentDescription: 'Rewards wallet top-up',
                redirectUrl: callbackUrl,
                currencyCode: checkoutCurrency,
                metaData: meta,
              })
              .then((init) => ({
                checkoutLink: init.checkoutUrl,
                orderReference: init.paymentReference,
                transactionReference: init.transactionReference,
              }))
          : provider === PaymentProvider.BACHS
            ? await this.bachsApi
                .createWalletTopupCheckout({
                  amount,
                  currency: currency as 'NGN' | 'USD',
                  customerEmail,
                  customerName: customerEmail.split('@')[0] || 'Customer',
                  successUrl: callbackUrl,
                  reference: orderReference,
                  metadata: meta,
                })
                .then((session) => ({
                  checkoutLink: session.checkout_url,
                  orderReference: session.reference ?? orderReference,
                  transactionReference: undefined as string | undefined,
                }))
            : provider === PaymentProvider.FINCRA
              ? await this.fincraApi
                  .createPayinCheckout({
                    amount,
                    currency,
                    customerEmail,
                    customerName: customerEmail.split('@')[0] || 'Customer',
                    reference: orderReference,
                    redirectUrl: callbackUrl,
                    metadata: { ...meta, orderReference },
                  })
                  .then((session) => ({
                    checkoutLink: session.checkoutLink,
                    orderReference: session.orderReference,
                    transactionReference: undefined as string | undefined,
                  }))
              : await this.noahApi
                .createPayinCheckout({
                  orderReference,
                  customerEmail,
                  amount,
                  currency,
                  callbackUrl,
                  customerId: tenantId,
                  tokenizeCard: false,
                  meta,
                })
                .then((session) => ({
                  checkoutLink: session.checkoutLink,
                  orderReference: session.orderReference,
                  transactionReference: undefined as string | undefined,
                }));

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
    const isNombaRef = isNombaWalletTopupOrderRef(input.orderReference, input.tenantId);
    const isMonnifyRef = isMonnifyWalletTopupOrderRef(input.orderReference, input.tenantId);
    const isNoahRef = isNoahWalletTopupOrderRef(input.orderReference, input.tenantId);
    const isBachsRef = isBachsWalletTopupOrderRef(input.orderReference, input.tenantId);
    const isFincraRef = isFincraWalletTopupOrderRef(input.orderReference, input.tenantId);

    if (billingProvider === PaymentProvider.NOMBA && !isNombaRef) {
      this.logger.warn(
        `Wallet checkout top-up reference tenant mismatch for ${input.orderReference}`,
      );
      return { received: true, credited: false };
    }
    if (billingProvider === PaymentProvider.MONNIFY && !isMonnifyRef) {
      this.logger.warn(`Monnify wallet checkout reference mismatch for ${input.orderReference}`);
      return { received: true, credited: false };
    }
    if (billingProvider === PaymentProvider.NOAH && !isNoahRef) {
      this.logger.warn(`Noah wallet checkout reference mismatch for ${input.orderReference}`);
      return { received: true, credited: false };
    }
    if (billingProvider === PaymentProvider.BACHS && !isBachsRef) {
      this.logger.warn(`Bachs wallet checkout reference mismatch for ${input.orderReference}`);
      return { received: true, credited: false };
    }
    if (billingProvider === PaymentProvider.FINCRA && !isFincraRef) {
      this.logger.warn(`Fincra wallet checkout reference mismatch for ${input.orderReference}`);
      return { received: true, credited: false };
    }

    const existing = await this.dataSource.getRepository(TenantWalletTransaction).findOne({
      where: { reference: input.orderReference },
    });
    if (existing) {
      // Idempotent: already credited (or recorded) for this payment reference.
      return { received: true, credited: existing.type === 'DEPOSIT' };
    }

    const wallet = await this.walletService.ensureWallet(input.tenantId);
    const currency = (wallet.currencyCode || DEFAULT_WALLET_CURRENCY_FALLBACK).toUpperCase();

    const verified =
      billingProvider === PaymentProvider.NOAH
        ? await this.noahApi.verifyTransaction(input.orderReference)
        : billingProvider === PaymentProvider.MONNIFY
          ? await this.monnifyApi
              .verifyTransaction(input.orderReference, input.transactionReference)
              .then((result) =>
                result
                  ? {
                      status: result.paid ? 'success' : 'pending',
                      amount: result.amount,
                      cardToken: result.cardToken,
                      customerEmail: result.customerEmail,
                      cardLastFour: result.cardLastFour,
                      cardBrand: result.cardBrand,
                      metaData: result.metaData,
                    }
                  : null,
              )
          : billingProvider === PaymentProvider.BACHS
            ? await this.bachsApi.findPaymentByReference(input.orderReference).then((result) =>
                result
                  ? {
                      status:
                        result.status === 'succeeded' || result.status === 'accepted'
                          ? 'success'
                          : result.status,
                      amount: result.amount,
                    }
                  : null,
              )
            : billingProvider === PaymentProvider.FINCRA
              ? await this.fincraApi.verifyPayinStatus(input.orderReference).then((result) =>
                  result
                    ? {
                        status: result.status,
                        amount: result.amount,
                        metaData: result.metadata,
                      }
                    : null,
                )
              : await this.nombaApi.verifyTransaction(input.orderReference);

    const status = verified?.status?.toLowerCase() ?? '';
    if (
      status !== 'success' &&
      status !== 'successful' &&
      status !== 'succeeded' &&
      status !== 'accepted'
    ) {
      this.logger.warn(
        `Wallet checkout top-up not yet successful for ${input.orderReference}: ${status || 'unknown'}`,
      );
      // Pending / not-yet-paid — Monnify should retry the webhook.
      return { received: true, credited: false, retryable: true };
    }

    const expected = input.amount ?? Number(verified?.amount ?? 0);
    const verifiedAmount = Number(verified?.amount ?? 0);
    // Prefer verified paid amount; fall back to expected when provider omits amountPaid.
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

    // Monnify: credit when amountPaid is at least expected (fees / overpay OK). Reject underpay only.
    if (input.amount && Number.isFinite(input.amount) && input.amount > 0) {
      if (paid + BILLING_AMOUNT_TOLERANCE < input.amount) {
        this.logger.warn(
          `Wallet checkout top-up underpaid for ${input.orderReference}: expected ${input.amount}, got ${paid}`,
        );
        return { received: true, credited: false };
      }
    }

    const creditResult = await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(TenantWallet)
        .createQueryBuilder('w')
        .setLock('pessimistic_write')
        .where('w.tenantId = :tenantId', { tenantId: input.tenantId })
        .getOneOrFail();

      const dup = await manager.getRepository(TenantWalletTransaction).findOne({
        where: { reference: input.orderReference },
      });
      if (dup) {
        return { received: true, credited: false };
      }

      const actorMemberId = this.requireInitiatingTenantMemberId(
        this.resolveCheckoutActorMemberId(input, verified ?? null),
      );

      await this.walletService.credit(
        input.tenantId,
        paid,
        'DEPOSIT',
        input.orderReference,
        `Rewards wallet top-up via checkout`,
        manager,
        {
          providerEventId: input.orderReference,
          actorMemberId,
        },
      );
      this.logger.log(
        `Credited wallet ${input.tenantId} for checkout top-up ${input.orderReference}`,
      );
      return { received: true, credited: true };
    });

    if (
      creditResult.credited &&
      billingProvider === PaymentProvider.MONNIFY &&
      verified &&
      'cardToken' in verified &&
      typeof verified.cardToken === 'string' &&
      verified.cardToken
    ) {
      const monnifyVerified = verified as {
        cardToken: string;
        customerEmail?: string;
        cardLastFour?: string;
        cardBrand?: string;
      };
      await this.persistMonnifyWalletCardToken(input.tenantId, {
        cardToken: monnifyVerified.cardToken,
        customerEmail: monnifyVerified.customerEmail,
        cardLastFour: monnifyVerified.cardLastFour,
        cardBrand: monnifyVerified.cardBrand,
      });
    }

    return creditResult;
  }

  private requireInitiatingTenantMemberId(memberId?: string | null): string {
    const id = memberId?.trim();
    if (!id) {
      throw new BadRequestException('A tenant member is required to credit the wallet');
    }
    return id;
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

  private async persistMonnifyWalletCardToken(
    tenantId: string,
    input: {
      cardToken: string;
      customerEmail?: string;
      cardLastFour?: string;
      cardBrand?: string;
    },
  ): Promise<void> {
    const subscription = await this.subscriptionsService.getTenantSubscription(tenantId);
    if (!subscription) {
      return;
    }
    subscription.usageMetrics = {
      ...(subscription.usageMetrics ?? {}),
      monnifyWalletCardToken: input.cardToken,
      monnifyWalletCardEmail: input.customerEmail?.trim() || undefined,
    };
    if (!subscription.paymentMethodId) {
      subscription.paymentMethodId = input.cardToken;
    }
    if (input.cardLastFour) {
      subscription.paymentMethodLastFour = input.cardLastFour.slice(-4);
    }
    if (input.cardBrand) {
      subscription.paymentMethodBrand = input.cardBrand;
    }
    await this.dataSource.getRepository(TenantSubscription).save(subscription);
    this.logger.log(`Stored Monnify wallet card token for tenant ${tenantId}`);
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
    if (walletProvider === PaymentProvider.BACHS || walletProvider === PaymentProvider.FINCRA) {
      this.logger.debug(
        `Skipping auto-topup for tenant ${tenantId}: saved-card top-up is unavailable on ${walletProvider}`,
      );
      return;
    }

    const chargeReference =
      walletProvider === PaymentProvider.MONNIFY
        ? buildMonnifyWalletTopupOrderRef(tenantId)
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

  async chargeAndCredit(
    tenantId: string,
    amount: number,
    reference: string,
    description: string,
    manager: EntityManager | undefined,
    audience: ChargeAudience = 'admin',
    actorMemberId: string,
  ): Promise<TenantWallet> {
    const initiatingMemberId = this.requireInitiatingTenantMemberId(actorMemberId);
    this.assertTopupAmount(amount);

    const subscription = await this.subscriptionsService.getTenantSubscription(tenantId);
    const metrics = subscription?.usageMetrics;
    const monnifyCardToken = metrics?.monnifyWalletCardToken?.trim();
    const monnifyCardEmail = metrics?.monnifyWalletCardEmail?.trim();
    const tokenKey = (monnifyCardToken || subscription?.paymentMethodId)?.trim();
    if (!tokenKey) {
      throw new BadRequestException(
        audience === 'admin' ? WALLET_NO_BILLING_CARD : WALLET_UNAVAILABLE_MEMBER,
      );
    }

    let customerEmail: string;
    try {
      const resolved = monnifyCardEmail || (await this.resolveBillingEmail(tenantId));
      if (!resolved) {
        throw new Error('Billing contact email is not configured');
      }
      customerEmail = resolved;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.notifyWalletChargeFailed(tenantId, amount, DEFAULT_WALLET_CURRENCY_FALLBACK, reason);
      throw new BadRequestException(
        audience === 'admin' ? WALLET_CHARGE_FAILED_ADMIN : WALLET_UNAVAILABLE_MEMBER,
      );
    }

    const wallet = await this.walletService.ensureWallet(tenantId, manager);
    const currency = (wallet.currencyCode || DEFAULT_WALLET_CURRENCY_FALLBACK).toUpperCase();
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    const provider = resolveRewardsWalletPaymentProvider(tenant?.countryCode, currency);

    if (provider === PaymentProvider.BACHS || provider === PaymentProvider.FINCRA) {
      throw new BadRequestException(
        audience === 'admin' ? WALLET_SAVED_CARD_UNSUPPORTED : WALLET_UNAVAILABLE_MEMBER,
      );
    }
    if (provider === PaymentProvider.NOMBA && !isNombaConfigured()) {
      throw new BadRequestException(WALLET_CHECKOUT_UNAVAILABLE);
    }
    if (provider === PaymentProvider.MONNIFY && !this.monnifyApi.isConfigured()) {
      throw new BadRequestException(WALLET_CHECKOUT_UNAVAILABLE);
    }
    if (provider === PaymentProvider.NOAH && !isNoahConfigured()) {
      throw new BadRequestException(WALLET_CHECKOUT_UNAVAILABLE);
    }
    if (provider === PaymentProvider.MONNIFY) {
      const monnifyToken = monnifyCardToken || (tokenKey.startsWith('MNFY_') ? tokenKey : null);
      if (!monnifyToken) {
        throw new BadRequestException(
          audience === 'admin' ? WALLET_NO_BILLING_CARD : WALLET_UNAVAILABLE_MEMBER,
        );
      }
    }

    let chargeReference = reference;
    try {
      if (provider === PaymentProvider.MONNIFY) {
        const cardToken = monnifyCardToken || tokenKey;
        const paymentReference = isMonnifyWalletTopupOrderRef(reference, tenantId)
          ? reference
          : buildMonnifyWalletTopupOrderRef(tenantId);
        const charge = await this.monnifyApi.chargeCardToken({
          cardToken,
          amount,
          customerName: customerEmail.split('@')[0] || 'Customer',
          customerEmail,
          paymentReference,
          paymentDescription: description,
          currencyCode: currency,
          metaData: {
            tenantId,
            billingType: 'wallet_topup',
            initiatedByMemberId: initiatingMemberId,
          },
        });
        chargeReference = charge.paymentReference;
        const verified = await this.monnifyApi.verifyTransaction(chargeReference);
        if (!verified?.paid) {
          throw new Error('Payment verification failed');
        }
        const normalizedPaid = normalizeWebhookAmount(
          Number(verified.amount ?? 0),
          amount,
          currency,
        );
        if (!Number.isFinite(normalizedPaid) || !isAmountWithinTolerance(normalizedPaid, amount)) {
          throw new Error(
            `Payment amount mismatch (expected ${amount}, got ${verified.amount ?? 'unknown'})`,
          );
        }
      } else {
        const charge =
          provider === PaymentProvider.NOMBA
            ? await this.nombaApi.chargeTokenizedCard({
                orderReference: reference,
                customerEmail,
                amount,
                currency,
                callbackUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
                tokenKey,
                meta: {
                  tenantId,
                  billingType: 'wallet_topup',
                  initiatedByMemberId: initiatingMemberId,
                },
              })
            : await this.noahApi.chargeSavedPaymentMethod({
                orderReference: reference,
                customerEmail,
                amount,
                currency,
                callbackUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
                paymentMethodId: tokenKey,
                meta: {
                  tenantId,
                  billingType: 'wallet_topup',
                  initiatedByMemberId: initiatingMemberId,
                },
              });

        chargeReference = charge.orderReference;
        const verified =
          provider === PaymentProvider.NOMBA
            ? await this.nombaApi.verifyTransaction(chargeReference)
            : await this.noahApi.verifyTransaction(chargeReference);

        if (!verified || !isNoahPaymentVerified(verified.status)) {
          throw new Error('Payment verification failed');
        }

        const normalizedPaid = normalizeWebhookAmount(
          Number(verified.amount ?? 0),
          amount,
          currency,
        );
        if (!Number.isFinite(normalizedPaid) || !isAmountWithinTolerance(normalizedPaid, amount)) {
          throw new Error(
            `Payment amount mismatch (expected ${amount}, got ${verified.amount ?? 'unknown'})`,
          );
        }
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.notifyWalletChargeFailed(tenantId, amount, currency, reason);
      throw new BadRequestException(
        audience === 'admin' ? WALLET_CHARGE_FAILED_ADMIN : WALLET_UNAVAILABLE_MEMBER,
      );
    }

    try {
      return await this.walletService.credit(
        tenantId,
        amount,
        'DEPOSIT',
        reference,
        description,
        manager,
        {
          providerEventId: chargeReference,
          actorMemberId: initiatingMemberId,
        },
      );
    } catch (error) {
      this.logger.error(
        `CRITICAL: Payment charged (${chargeReference}) but wallet credit failed for tenant ${tenantId}: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException(WALLET_CREDIT_FAILED);
    }
  }

  private async resolveBillingEmail(tenantId: string): Promise<string | null> {
    try {
      const settings = await this.tenantSettingsService.getTenantSettings(tenantId);
      const contactEmail = settings.settings.billing?.contactEmail?.trim();
      if (contactEmail) return contactEmail;
    } catch {}

    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
      relations: ['createdBy'],
    });
    return tenant?.createdBy?.email?.trim() ?? null;
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

    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
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
      html: `<p>A rewards wallet payment failed for <strong>${tenant?.name ?? 'your workspace'}</strong>.</p>
<p>Amount: <strong>${currency} ${amount.toLocaleString()}</strong></p>
<p>Reason: ${reason}</p>
<p><a href="${settingsUrl}">Open Rewards settings</a></p>`,
    });
  }

  private assertTopupAmount(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Top up amount must be greater than 0');
    }
    if (amount > WALLET_TOPUP_MAX_AMOUNT) {
      throw new BadRequestException(`Top up amount cannot exceed ${WALLET_TOPUP_MAX_AMOUNT}`);
    }
  }
}
