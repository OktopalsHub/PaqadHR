import { isCryptoCurrency } from '../constants/crypto-currencies.constant';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentMethodType } from '../enums/payment-type.enum';

export function resolvePaymentProvider(
  currency: string,
  paymentMethodType?: PaymentMethodType,
): PaymentProvider {
  const code = currency.toUpperCase();

  if (isCryptoCurrency(code) || paymentMethodType === PaymentMethodType.CRYPTO) {
    return PaymentProvider.NOAH;
  }

  if (code === 'NGN') {
    return PaymentProvider.NOMBA;
  }

  return PaymentProvider.NOAH;
}

export function paymentProviderLabel(provider: PaymentProvider): string {
  return provider === PaymentProvider.NOMBA ? 'Nomba' : 'Noah';
}
