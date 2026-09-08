import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DEFAULT_WALLET_CURRENCY_FALLBACK } from 'src/common/utils/rewards-defaults.util';
import { tenantFrontendUrl } from 'src/common/utils/tenant-frontend-url.util';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ZeptomailEmailService } from '../../notifications/services/zeptomail-email.service';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
import {
  WALLET_CHARGE_FAILED_ADMIN,
  WALLET_CREDIT_FAILED,
  WALLET_UNAVAILABLE_MEMBER,
} from '../constants/wallet-error-messages';
import { TenantWallet } from '../entities/tenant-wallet.entity';
import { ProviderRoutingService } from './provider-routing.service';
import { SavedCardChargeService } from './saved-card-charge.service';
import { TenantWalletService } from './tenant-wallet.service';

type ChargeAudience = 'member' | 'admin';

@Injectable()
export class TopupChargeService {
  private readonly logger = new Logger(TopupChargeService.name);

  constructor(
    readonly _dataSource: DataSource,
    private readonly walletService: TenantWalletService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly emailService: ZeptomailEmailService,
    private readonly providerRouting: ProviderRoutingService,
    private readonly savedCardCharge: SavedCardChargeService,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  requireInitiatingTenantMemberId(memberId?: string | null): string {
    const id = memberId?.trim();
    if (!id) {
      throw new BadRequestException('A tenant member is required to credit the wallet');
    }
    return id;
  }

  resolveBillingEmail(tenantId: string) {
    return this.providerRouting.resolveBillingEmail(tenantId);
  }

  assertTopupAmount(amount: number): void {
    const { WALLET_TOPUP_MAX_AMOUNT } = require('../constants/wallet.constants');
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Top up amount must be greater than 0');
    }
    if (amount > WALLET_TOPUP_MAX_AMOUNT) {
      throw new BadRequestException(`Top up amount cannot exceed ${WALLET_TOPUP_MAX_AMOUNT}`);
    }
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
        audience === 'admin' ? WALLET_CHARGE_FAILED_ADMIN : WALLET_UNAVAILABLE_MEMBER,
      );
    }

    let customerEmail: string;
    try {
      const resolved =
        monnifyCardEmail || (await this.providerRouting.resolveBillingEmail(tenantId));
      if (!resolved) throw new Error('Billing contact email is not configured');
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
    const provider = await this.providerRouting.resolvePaymentProvider(tenantId, currency);

    this.savedCardCharge.assertProviderAvailable(provider, monnifyCardToken, tokenKey, audience);

    let chargeReference = reference;
    try {
      chargeReference = await this.savedCardCharge.executeCharge(
        provider,
        tenantId,
        amount,
        currency,
        customerEmail,
        reference,
        description,
        initiatingMemberId,
        tokenKey,
        monnifyCardToken,
      );
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
        { providerEventId: chargeReference, actorMemberId: initiatingMemberId },
      );
    } catch (error) {
      this.logger.error(
        `CRITICAL: Payment charged (${chargeReference}) but wallet credit failed for tenant ${tenantId}: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException(WALLET_CREDIT_FAILED);
    }
  }

  notifyWalletChargeFailed(
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
    const email = await this.providerRouting.resolveBillingEmail(tenantId);
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
