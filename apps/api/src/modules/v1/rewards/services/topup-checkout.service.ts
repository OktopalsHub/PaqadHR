import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { PaymentProviderFactoryService } from 'src/common/services/payment-provider-factory.service';
import { DEFAULT_WALLET_CURRENCY_FALLBACK } from 'src/common/utils/rewards-defaults.util';
import { tenantFrontendUrl } from 'src/common/utils/tenant-frontend-url.util';
import { DataSource, Repository } from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { resolveRewardsWalletPaymentProvider } from '../config/rewards-wallet-provider.config';
import { WALLET_TOPUP_MAX_AMOUNT } from '../constants/wallet.constants';
import { WALLET_CHECKOUT_UNAVAILABLE } from '../constants/wallet-error-messages';
import { resolveCheckoutCustomerFullName } from '../utils/checkout-customer-name.util';
import { buildWalletTopupOrderRef } from '../utils/wallet-order-ref.util';
import { TenantWalletService } from './tenant-wallet.service';

@Injectable()
export class TopupCheckoutService {
  constructor(
    readonly _dataSource: DataSource,
    private readonly walletService: TenantWalletService,
    private readonly factory: PaymentProviderFactoryService,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  async manualTopup(
    tenantId: string,
    amount: number,
    initiatedByMemberId: string,
  ): Promise<{ id: string }> {
    const wallet = await this.walletService.ensureWallet(tenantId);
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    const provider = resolveRewardsWalletPaymentProvider(tenant?.countryCode, wallet.currencyCode);
    const reference =
      provider === PaymentProvider.MONNIFY
        ? buildWalletTopupOrderRef(PaymentProvider.MONNIFY, tenantId)
        : `manual-topup-${randomUUID()}`;
    return { id: reference };
  }

  async createTopupCheckout(
    tenantId: string,
    amount: number,
    initiatedByMemberId: string,
    resolveBillingEmail: (tenantId: string) => Promise<string | null>,
  ): Promise<{ checkoutUrl: string; orderReference: string; transactionReference?: string }> {
    this.assertTopupAmount(amount);
    const actorMemberId = this.requireInitiatingTenantMemberId(initiatedByMemberId);

    const customerEmail = await resolveBillingEmail(tenantId);
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

    const meta = {
      tenantId,
      billingType: 'wallet_topup',
      expectedAmount: String(amount),
      initiatedByMemberId: actorMemberId,
    };

    const customerName = resolveCheckoutCustomerFullName(tenant?.name, customerEmail);

    const result = await adapter.createCheckout({
      orderReference,
      customerEmail,
      amount,
      currency,
      callbackUrl,
      customerName,
      meta,
    });

    return {
      checkoutUrl: result.checkoutLink,
      orderReference: result.orderReference,
      ...(result.transactionReference ? { transactionReference: result.transactionReference } : {}),
    };
  }

  requireInitiatingTenantMemberId(memberId?: string | null): string {
    const id = memberId?.trim();
    if (!id) {
      throw new BadRequestException('A tenant member is required to credit the wallet');
    }
    return id;
  }

  assertTopupAmount(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Top up amount must be greater than 0');
    }
    if (amount > WALLET_TOPUP_MAX_AMOUNT) {
      throw new BadRequestException(`Top up amount cannot exceed ${WALLET_TOPUP_MAX_AMOUNT}`);
    }
  }
}
