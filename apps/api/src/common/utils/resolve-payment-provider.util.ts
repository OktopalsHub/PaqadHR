import { BadRequestException } from '@nestjs/common';
import { normalizeBachsUsdtNetwork } from '../config/bachs-payout.util';
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
    // unconditionally so a payout can never settle on a different chain. Other USDT
    // networks (ERC20) are not Bachs rails and stay on the Noah/Fincra path. If
    // Bachs is not configured the item fails loudly instead of moving funds.
    const bachsNetwork = normalizeBachsUsdtNetwork(cryptoNetwork);
    if (code === 'USDT' && (bachsNetwork === 'TRC20' || bachsNetwork === 'BEP20')) {
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
