import { isNoahConfigured } from '../config/noah.config';
import {
  isCryptoCurrency,
  isNoahNativeCryptoCurrency,
} from '../constants/crypto-currencies.constant';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentMethodType } from '../enums/payment-type.enum';
import { resolveIntlPaymentProvider } from './intl-money-provider.util';
import { resolveNgPaymentProvider } from './ng-money-provider.util';

export function resolvePaymentProvider(
  currency: string,
  paymentMethodType?: PaymentMethodType,
): PaymentProvider {
  const code = currency.toUpperCase();

  // BTC / ETH / SOL are Noah withdraw rails when Noah is configured.
  if (isNoahNativeCryptoCurrency(code) && isNoahConfigured()) {
    return PaymentProvider.NOAH;
  }

  if (isCryptoCurrency(code) || paymentMethodType === PaymentMethodType.CRYPTO) {
    return resolveIntlPaymentProvider();
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
    default:
      return 'International transfer';
  }
}
