import { BadRequestException } from '@nestjs/common';
import { isBachsConfigured } from '../config/bachs.config';
import { mapBachsCryptoDestinationCurrency } from '../config/bachs-payout.util';
import {
  isCryptoCurrency,
  isNoahNativeCryptoCurrency,
} from '../constants/crypto-currencies.constant';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentMethodType } from '../enums/payment-type.enum';
import {
  resolveIntlCryptoPaymentProvider,
  resolveIntlPaymentProvider,
} from './intl-money-provider.util';
import { resolveNgPaymentProvider } from './ng-money-provider.util';

export function resolvePaymentProvider(
  currency: string,
  paymentMethodType?: PaymentMethodType,
  cryptoNetwork?: string,
): PaymentProvider {
  const code = currency.toUpperCase();

  // Stablecoins only. A native asset (BTC/ETH/SOL) is not a payable currency — Bachs cannot
  // deliver it and Noah is no longer a payroll rail for it. Fail loudly at routing time
  // instead of constructing a payout that can only 402 at the provider.
  if (isNoahNativeCryptoCurrency(code)) {
    throw new BadRequestException(
      `${code} payouts are not supported. Pay employees in USDT or USDC instead.`,
    );
  }

  if (isCryptoCurrency(code) || paymentMethodType === PaymentMethodType.CRYPTO) {
    // Bachs is the only rail that delivers USDT on TRC20/BEP20 — route those there
    // unconditionally so a payout can never settle on a different chain. Every other pair
    // Bachs delivers (USDT on ERC20/SOL, USDC on BEP20/ERC20/SOL/BASE) goes there too once Bachs
    // is configured. Pairs outside its matrix stay on the Noah/Fincra path and fail loudly
    // there rather than being sent on a chain the rail cannot honour.
    const bachsDestination = mapBachsCryptoDestinationCurrency(cryptoNetwork, code);
    const bachsOnlyChain = bachsDestination === 'USDT_TRC20' || bachsDestination === 'USDT_BEP20';
    if (bachsDestination && (bachsOnlyChain || isBachsConfigured())) {
      return PaymentProvider.BACHS;
    }
    return resolveIntlCryptoPaymentProvider();
  }

  if (code === 'NGN') {
    return resolveNgPaymentProvider();
  }

  return resolveIntlPaymentProvider();
}

export function paymentProviderLabel(provider: PaymentProvider): string {
  switch (provider) {
    case PaymentProvider.NOMBA:
    case PaymentProvider.MONNIFY:
      return 'Local bank transfer';
    case PaymentProvider.FINCRA:
      return 'Fincra transfer';
    case PaymentProvider.BACHS:
      return 'Bachs transfer';
    default:
      return 'International transfer';
  }
}
