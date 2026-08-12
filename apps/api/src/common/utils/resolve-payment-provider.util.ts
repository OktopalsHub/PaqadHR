import { isCryptoCurrency } from '../constants/crypto-currencies.constant';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentMethodType } from '../enums/payment-type.enum';
import { resolveNgPaymentProvider } from './ng-money-provider.util';

export function resolvePaymentProvider(
  currency: string,
  paymentMethodType?: PaymentMethodType,
): PaymentProvider {
  const code = currency.toUpperCase();

  if (isCryptoCurrency(code) || paymentMethodType === PaymentMethodType.CRYPTO) {
    return PaymentProvider.NOAH;
  }

  if (code === 'NGN') {
    return resolveNgPaymentProvider();
  }

  return PaymentProvider.NOAH;
}

export function paymentProviderLabel(provider: PaymentProvider): string {
  switch (provider) {
    case PaymentProvider.NOMBA:
    case PaymentProvider.MONNIFY:
      return 'Local bank transfer';
    default:
      return 'International transfer';
  }
}
