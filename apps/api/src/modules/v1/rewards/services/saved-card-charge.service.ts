import { BadRequestException, Injectable } from '@nestjs/common';
import { isNoahPaymentVerified } from 'src/common/config/noah-api.util';
import { isNombaConfigured } from 'src/common/config/nomba.config';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { MonnifyApiService } from 'src/common/services/monnify-api.service';
import { NoahApiService } from 'src/common/services/noah-api.service';
import { NombaApiService } from '../../subscriptions/services/nomba-api.service';
import {
  isAmountWithinTolerance,
  normalizeWebhookAmount,
} from '../../subscriptions/utils/per-seat-pricing.util';
import {
  WALLET_CHECKOUT_UNAVAILABLE,
  WALLET_NO_BILLING_CARD,
  WALLET_SAVED_CARD_UNSUPPORTED,
  WALLET_UNAVAILABLE_MEMBER,
} from '../constants/wallet-error-messages';
import {
  buildWalletTopupOrderRef,
  isMonnifyWalletTopupOrderRef,
} from '../utils/wallet-order-ref.util';
import { TenantWalletService } from './tenant-wallet.service';

type ChargeAudience = 'member' | 'admin';

@Injectable()
export class SavedCardChargeService {
  constructor(
    readonly _walletService: TenantWalletService,
    private readonly nombaApi: NombaApiService,
    private readonly monnifyApi: MonnifyApiService,
    private readonly noahApi: NoahApiService,
  ) {}

  assertProviderAvailable(
    provider: PaymentProvider,
    monnifyCardToken: string | undefined,
    tokenKey: string,
    audience: ChargeAudience,
  ): void {
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
    if (provider === PaymentProvider.NOAH && !this.noahApi.isConfigured()) {
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
  }

  async executeCharge(
    provider: PaymentProvider,
    tenantId: string,
    amount: number,
    currency: string,
    customerEmail: string,
    reference: string,
    description: string,
    initiatingMemberId: string,
    tokenKey: string,
    monnifyCardToken: string | undefined,
  ): Promise<string> {
    if (provider === PaymentProvider.MONNIFY) {
      return this.chargeMonnify(
        tenantId,
        amount,
        currency,
        customerEmail,
        reference,
        description,
        initiatingMemberId,
        monnifyCardToken,
        tokenKey,
      );
    }
    return this.chargeNombaOrNoah(
      provider,
      tenantId,
      amount,
      currency,
      customerEmail,
      reference,
      description,
      initiatingMemberId,
      tokenKey,
    );
  }

  private async chargeMonnify(
    tenantId: string,
    amount: number,
    currency: string,
    customerEmail: string,
    reference: string,
    description: string,
    initiatingMemberId: string,
    monnifyCardToken: string | undefined,
    tokenKey: string,
  ): Promise<string> {
    const cardToken = monnifyCardToken || tokenKey;
    const paymentReference = isMonnifyWalletTopupOrderRef(reference, tenantId)
      ? reference
      : buildWalletTopupOrderRef(PaymentProvider.MONNIFY, tenantId);
    const charge = await this.monnifyApi.chargeCardToken({
      cardToken,
      amount,
      customerName: customerEmail.split('@')[0] || 'Customer',
      customerEmail,
      paymentReference,
      paymentDescription: description,
      currencyCode: currency,
      metaData: { tenantId, billingType: 'wallet_topup', initiatedByMemberId: initiatingMemberId },
    });
    const verified = await this.monnifyApi.verifyTransaction(charge.paymentReference);
    if (!verified?.paid) throw new Error('Payment verification failed');
    const normalizedPaid = normalizeWebhookAmount(Number(verified.amount ?? 0), amount, currency);
    if (!Number.isFinite(normalizedPaid) || !isAmountWithinTolerance(normalizedPaid, amount)) {
      throw new Error(
        `Payment amount mismatch (expected ${amount}, got ${verified.amount ?? 'unknown'})`,
      );
    }
    return charge.paymentReference;
  }

  private async chargeNombaOrNoah(
    provider: PaymentProvider,
    tenantId: string,
    amount: number,
    currency: string,
    customerEmail: string,
    reference: string,
    description: string,
    initiatingMemberId: string,
    tokenKey: string,
  ): Promise<string> {
    const meta = { tenantId, billingType: 'wallet_topup', initiatedByMemberId: initiatingMemberId };
    const callbackUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const charge =
      provider === PaymentProvider.NOMBA
        ? await this.nombaApi.chargeTokenizedCard({
            orderReference: reference,
            customerEmail,
            amount,
            currency,
            callbackUrl,
            tokenKey,
            meta,
          })
        : await this.noahApi.chargeSavedPaymentMethod({
            orderReference: reference,
            customerEmail,
            amount,
            currency,
            callbackUrl,
            paymentMethodId: tokenKey,
            meta,
          });
    const verified =
      provider === PaymentProvider.NOMBA
        ? await this.nombaApi.verifyTransaction(charge.orderReference)
        : await this.noahApi.verifyTransaction(charge.orderReference);
    if (!verified || !isNoahPaymentVerified(verified.status)) {
      throw new Error('Payment verification failed');
    }
    const normalizedPaid = normalizeWebhookAmount(Number(verified.amount ?? 0), amount, currency);
    if (!Number.isFinite(normalizedPaid) || !isAmountWithinTolerance(normalizedPaid, amount)) {
      throw new Error(
        `Payment amount mismatch (expected ${amount}, got ${verified.amount ?? 'unknown'})`,
      );
    }
    return charge.orderReference;
  }
}
