import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isNoahConfigured } from 'src/common/config/noah.config';
import { isNoahPaymentVerified } from 'src/common/config/noah-api.util';
import { isNombaConfigured } from 'src/common/config/nomba.config';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { NoahApiService } from 'src/common/services/noah-api.service';
import { resolvePaymentProvider } from 'src/common/utils/resolve-payment-provider.util';
import { tenantFrontendUrl } from 'src/common/utils/tenant-frontend-url.util';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ZeptomailEmailService } from '../../notifications/services/zeptomail-email.service';
import { NombaApiService } from '../../subscriptions/services/nomba-api.service';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';
import {
  isAmountWithinTolerance,
  normalizeWebhookAmount,
} from '../../subscriptions/utils/per-seat-pricing.util';
import { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
import {
  WALLET_CHARGE_FAILED_ADMIN,
  WALLET_CREDIT_FAILED,
  WALLET_NO_BILLING_CARD,
  WALLET_UNAVAILABLE_MEMBER,
} from '../constants/wallet-error-messages';
import { TenantWallet } from '../entities/tenant-wallet.entity';
import { TenantWalletTransaction } from '../entities/tenant-wallet-transaction.entity';
import {
  buildNoahWalletTopupOrderRef,
  buildNombaWalletTopupOrderRef,
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
    private readonly noahApi: NoahApiService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly tenantSettingsService: TenantSettingsService,
    private readonly emailService: ZeptomailEmailService,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  async manualTopup(
    tenantId: string,
    amount: number,
    _initiatedByMemberId?: string,
  ): Promise<TenantWallet> {
    const reference = `manual-topup-${randomUUID()}`;
    return this.chargeAndCredit(
      tenantId,
      amount,
      reference,
      'Manual rewards wallet top-up via saved payment method',
      undefined,
      'admin',
    );
  }

  async createTopupCheckout(
    tenantId: string,
    amount: number,
    initiatedByMemberId?: string,
  ): Promise<{ checkoutUrl: string; orderReference: string; provider: string }> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Top up amount must be greater than 0');
    }

    const customerEmail = await this.resolveBillingEmail(tenantId);
    if (!customerEmail) {
      throw new BadRequestException(
        'Billing contact email is not configured. Add it in Settings → Billing.',
      );
    }

    const wallet = await this.walletService.ensureWallet(tenantId);
    const currency = (wallet.currencyCode || 'NGN').toUpperCase();
    const provider = resolvePaymentProvider(currency);

    if (provider === PaymentProvider.NOMBA && !this.nombaApi.isConfigured()) {
      throw new BadRequestException('Nomba checkout is not configured');
    }
    if (provider === PaymentProvider.NOAH && !this.noahApi.isConfigured()) {
      throw new BadRequestException('Noah checkout is not configured');
    }

    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    const callbackUrl = tenant?.slug
      ? tenantFrontendUrl(tenant.slug, '/settings?tab=rewards&wallet_topup=done')
      : tenantFrontendUrl('', '/settings?tab=rewards&wallet_topup=done');

    const orderReference =
      provider === PaymentProvider.NOMBA
        ? buildNombaWalletTopupOrderRef(tenantId)
        : buildNoahWalletTopupOrderRef(tenantId);

    const meta = {
      tenantId,
      billingType: 'wallet_topup',
      expectedAmount: amount,
      ...(initiatedByMemberId ? { initiatedByMemberId } : {}),
    };

    const result =
      provider === PaymentProvider.NOMBA
        ? await this.nombaApi.createCheckoutOrder({
            orderReference,
            customerEmail,
            amount,
            currency,
            callbackUrl,
            tokenizeCard: false,
            meta,
          })
        : await this.noahApi.createPayinCheckout({
            orderReference,
            customerEmail,
            amount,
            currency,
            callbackUrl,
            customerId: tenantId,
            tokenizeCard: false,
            meta,
          });

    return {
      checkoutUrl: result.checkoutLink,
      orderReference: result.orderReference,
      provider: provider === PaymentProvider.NOMBA ? 'Nomba' : 'Noah',
    };
  }

  async completeCheckoutTopup(
    input: {
      tenantId: string;
      orderReference: string;
      amount?: number;
    },
    billingProvider: PaymentProvider = PaymentProvider.NOMBA,
  ): Promise<{ received: boolean; credited: boolean }> {
    const isNombaRef = isNombaWalletTopupOrderRef(input.orderReference, input.tenantId);
    const isNoahRef = isNoahWalletTopupOrderRef(input.orderReference, input.tenantId);

    if (billingProvider === PaymentProvider.NOMBA && !isNombaRef) {
      this.logger.warn(
        `Wallet checkout top-up reference tenant mismatch for ${input.orderReference}`,
      );
      return { received: true, credited: false };
    }
    if (billingProvider === PaymentProvider.NOAH && !isNoahRef) {
      this.logger.warn(`Noah wallet checkout reference mismatch for ${input.orderReference}`);
      return { received: true, credited: false };
    }

    const existing = await this.dataSource.getRepository(TenantWalletTransaction).findOne({
      where: { reference: input.orderReference },
    });
    if (existing) {
      return { received: true, credited: false };
    }

    const wallet = await this.walletService.ensureWallet(input.tenantId);
    const currency = (wallet.currencyCode || 'NGN').toUpperCase();

    const verified =
      billingProvider === PaymentProvider.NOAH
        ? await this.noahApi.verifyTransaction(input.orderReference)
        : await this.nombaApi.verifyTransaction(input.orderReference);

    const status = verified?.status?.toLowerCase() ?? '';
    if (status !== 'success' && status !== 'successful') {
      this.logger.warn(
        `Wallet checkout top-up not yet successful for ${input.orderReference}: ${status || 'unknown'}`,
      );
      throw new BadRequestException(
        `Wallet checkout top-up not yet successful: ${status || 'unknown'}`,
      );
    }

    const expected = input.amount ?? Number(verified?.amount ?? 0);
    const paid = normalizeWebhookAmount(Number(verified?.amount ?? 0), expected, currency);
    if (!Number.isFinite(paid) || paid <= 0) {
      this.logger.warn(`Wallet checkout top-up invalid amount for ${input.orderReference}`);
      return { received: true, credited: false };
    }

    if (
      input.amount &&
      Number.isFinite(input.amount) &&
      !isAmountWithinTolerance(paid, input.amount)
    ) {
      this.logger.warn(
        `Wallet checkout top-up amount mismatch for ${input.orderReference}: expected ${input.amount}, got ${paid}`,
      );
      return { received: true, credited: false };
    }

    const providerLabel = billingProvider === PaymentProvider.NOAH ? 'Noah' : 'Nomba';

    return this.dataSource.transaction(async (manager) => {
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

      await this.walletService.credit(
        input.tenantId,
        paid,
        'DEPOSIT',
        input.orderReference,
        `Rewards wallet top-up via ${providerLabel} checkout`,
        manager,
        { nombaEventId: input.orderReference },
      );
      this.logger.log(
        `Credited wallet ${input.tenantId} for ${providerLabel} checkout top-up ${input.orderReference}`,
      );
      return { received: true, credited: true };
    });
  }

  async maybeAutoTopupAfterDebit(tenantId: string): Promise<void> {
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

    await this.chargeAndCredit(
      tenantId,
      Number(wallet.autoTopupAmount),
      `auto-topup-${randomUUID()}`,
      `Automatic replenishment of rewards wallet (balance below ${wallet.autoTopupThreshold})`,
      undefined,
      'member',
    );
  }

  async chargeAndCredit(
    tenantId: string,
    amount: number,
    reference: string,
    description: string,
    manager?: EntityManager,
    audience: ChargeAudience = 'admin',
  ): Promise<TenantWallet> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Top up amount must be greater than 0');
    }

    const subscription = await this.subscriptionsService.getTenantSubscription(tenantId);
    const tokenKey = subscription?.paymentMethodId?.trim();
    if (!tokenKey) {
      throw new BadRequestException(
        audience === 'admin' ? WALLET_NO_BILLING_CARD : WALLET_UNAVAILABLE_MEMBER,
      );
    }

    let customerEmail: string;
    try {
      const resolved = await this.resolveBillingEmail(tenantId);
      if (!resolved) {
        throw new Error('Billing contact email is not configured');
      }
      customerEmail = resolved;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.notifyWalletChargeFailed(tenantId, amount, 'NGN', reason);
      throw new BadRequestException(
        audience === 'admin' ? WALLET_CHARGE_FAILED_ADMIN : WALLET_UNAVAILABLE_MEMBER,
      );
    }

    const wallet = await this.walletService.ensureWallet(tenantId, manager);
    const currency = (wallet.currencyCode || 'NGN').toUpperCase();
    const provider = resolvePaymentProvider(currency);

    if (provider === PaymentProvider.NOMBA && !isNombaConfigured()) {
      throw new BadRequestException('Nomba checkout is not configured');
    }
    if (provider === PaymentProvider.NOAH && !isNoahConfigured()) {
      throw new BadRequestException('Noah checkout is not configured');
    }

    let chargeReference = reference;
    try {
      const charge =
        provider === PaymentProvider.NOMBA
          ? await this.nombaApi.chargeTokenizedCard({
              orderReference: reference,
              customerEmail,
              amount,
              currency,
              callbackUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
              tokenKey,
              meta: { tenantId, billingType: 'wallet_topup' },
            })
          : await this.noahApi.chargeSavedPaymentMethod({
              orderReference: reference,
              customerEmail,
              amount,
              currency,
              callbackUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
              paymentMethodId: tokenKey,
              meta: { tenantId, billingType: 'wallet_topup' },
            });

      chargeReference = charge.orderReference;
      const verified =
        provider === PaymentProvider.NOMBA
          ? await this.nombaApi.verifyTransaction(chargeReference)
          : await this.noahApi.verifyTransaction(chargeReference);

      if (!verified || !isNoahPaymentVerified(verified.status)) {
        throw new Error('Payment verification failed');
      }

      const normalizedPaid = normalizeWebhookAmount(Number(verified.amount ?? 0), amount, currency);
      if (!Number.isFinite(normalizedPaid) || !isAmountWithinTolerance(normalizedPaid, amount)) {
        throw new Error(
          `Payment amount mismatch (expected ${amount}, got ${verified.amount ?? 'unknown'})`,
        );
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
          nombaEventId: chargeReference,
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
}
