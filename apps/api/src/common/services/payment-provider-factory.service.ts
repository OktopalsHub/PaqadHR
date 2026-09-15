import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentMethodType } from '../enums/payment-type.enum';
import type { CheckoutProvider } from '../interfaces/checkout-provider.interface';
import type { PayoutStatusQuerier } from '../interfaces/payout-status-querier.interface';
import { BachsProvider } from '../providers/bachs.provider';
import { BachsCheckoutAdapter } from '../providers/checkout-providers/bachs-checkout.adapter';
import { FincraCheckoutAdapter } from '../providers/checkout-providers/fincra-checkout.adapter';
import { MonnifyCheckoutAdapter } from '../providers/checkout-providers/monnify-checkout.adapter';
import { NoahCheckoutAdapter } from '../providers/checkout-providers/noah-checkout.adapter';
import { NombaCheckoutAdapter } from '../providers/checkout-providers/nomba-checkout.adapter';
import { FincraProvider } from '../providers/fincra.provider';
import { MonnifyProvider } from '../providers/monnify.provider';
import { NoahProvider } from '../providers/noah.provider';
import { NombaProvider } from '../providers/nomba.provider';
import { BachsPayoutQuerierAdapter } from '../providers/payout-queriers/bachs-payout-querier.adapter';
import { FincraPayoutQuerierAdapter } from '../providers/payout-queriers/fincra-payout-querier.adapter';
import { MonnifyPayoutQuerierAdapter } from '../providers/payout-queriers/monnify-payout-querier.adapter';
import { NoahPayoutQuerierAdapter } from '../providers/payout-queriers/noah-payout-querier.adapter';
import { NombaPayoutQuerierAdapter } from '../providers/payout-queriers/nomba-payout-querier.adapter';
import {
  paymentProviderLabel,
  resolvePaymentProvider,
} from '../utils/resolve-payment-provider.util';

@Injectable()
export class PaymentProviderFactoryService {
  private readonly checkoutAdapters: Record<string, CheckoutProvider>;
  private readonly payoutQueriers: Record<string, PayoutStatusQuerier>;

  constructor(
    private readonly nombaProvider: NombaProvider,
    private readonly monnifyProvider: MonnifyProvider,
    private readonly noahProvider: NoahProvider,
    private readonly fincraProvider: FincraProvider,
    private readonly bachsProvider: BachsProvider,
    readonly nombaCheckout: NombaCheckoutAdapter,
    readonly monnifyCheckout: MonnifyCheckoutAdapter,
    readonly noahCheckout: NoahCheckoutAdapter,
    readonly fincraCheckout: FincraCheckoutAdapter,
    readonly bachsCheckout: BachsCheckoutAdapter,
    readonly nombaPayoutQuerier: NombaPayoutQuerierAdapter,
    readonly monnifyPayoutQuerier: MonnifyPayoutQuerierAdapter,
    readonly noahPayoutQuerier: NoahPayoutQuerierAdapter,
    readonly fincraPayoutQuerier: FincraPayoutQuerierAdapter,
    readonly bachsPayoutQuerier: BachsPayoutQuerierAdapter,
  ) {
    this.checkoutAdapters = {
      [PaymentProvider.NOMBA]: nombaCheckout,
      [PaymentProvider.MONNIFY]: monnifyCheckout,
      [PaymentProvider.NOAH]: noahCheckout,
      [PaymentProvider.FINCRA]: fincraCheckout,
      [PaymentProvider.BACHS]: bachsCheckout,
    };
    this.payoutQueriers = {
      [PaymentProvider.NOMBA]: nombaPayoutQuerier,
      [PaymentProvider.MONNIFY]: monnifyPayoutQuerier,
      [PaymentProvider.NOAH]: noahPayoutQuerier,
      [PaymentProvider.FINCRA]: fincraPayoutQuerier,
      [PaymentProvider.BACHS]: bachsPayoutQuerier,
    };
  }

  resolveProvider(currency: string, paymentMethodType?: PaymentMethodType, cryptoNetwork?: string) {
    const provider = resolvePaymentProvider(currency, paymentMethodType, cryptoNetwork);
    if (provider === PaymentProvider.FINCRA) {
      return this.fincraProvider;
    }
    if (provider === PaymentProvider.MONNIFY) {
      return this.monnifyProvider;
    }
    if (provider === PaymentProvider.NOMBA) {
      return this.nombaProvider;
    }
    if (provider === PaymentProvider.BACHS) {
      return this.bachsProvider;
    }
    return this.noahProvider;
  }

  resolveProviderName(
    currency: string,
    paymentMethodType?: PaymentMethodType,
    cryptoNetwork?: string,
  ): string {
    return paymentProviderLabel(resolvePaymentProvider(currency, paymentMethodType, cryptoNetwork));
  }

  async createPayment(data: Parameters<NombaProvider['createPayment']>[0]) {
    return this.resolveProvider(data.currency).createPayment(data);
  }

  getFiatProvider(currency: string, paymentMethodType?: PaymentMethodType, cryptoNetwork?: string) {
    return this.resolveProvider(currency, paymentMethodType, cryptoNetwork);
  }

  resolveCheckoutAdapter(provider: PaymentProvider): CheckoutProvider | undefined {
    return this.checkoutAdapters[provider];
  }

  resolvePayoutQuerier(provider: PaymentProvider): PayoutStatusQuerier | undefined {
    return this.payoutQueriers[provider];
  }

  getNombaProvider() {
    return this.nombaProvider;
  }

  getMonnifyProvider() {
    return this.monnifyProvider;
  }

  getNoahProvider() {
    return this.noahProvider;
  }

  getFincraProvider() {
    return this.fincraProvider;
  }

  getBachsProvider() {
    return this.bachsProvider;
  }
}
