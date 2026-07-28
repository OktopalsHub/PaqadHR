/**
 * Self-check: payroll rail matching (run currency ↔ payment method type).
 * Run: npx tsx apps/api/src/modules/v1/payroll/utils/payroll-rail.check.ts
 */
import { isCryptoCurrency } from '../../../../common/constants/crypto-currencies.constant';
import { PaymentMethodType } from '../../../../common/enums';
import { PaymentProvider } from '../../../../common/enums/payment-provider.enum';
import {
  paymentProviderLabel,
  resolvePaymentProvider,
} from '../../../../common/utils/resolve-payment-provider.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function railOk(runCurrency: string, methodType: PaymentMethodType): boolean {
  const cryptoRun = isCryptoCurrency(runCurrency);
  const cryptoMethod = methodType === PaymentMethodType.CRYPTO;
  return cryptoRun === cryptoMethod;
}

assert(resolvePaymentProvider('NGN') === PaymentProvider.NOMBA, 'NGN → Nomba');
assert(resolvePaymentProvider('USD') === PaymentProvider.NOAH, 'USD → Noah');
assert(resolvePaymentProvider('USDC') === PaymentProvider.NOAH, 'USDC → Noah');
assert(railOk('NGN', PaymentMethodType.BANK), 'NGN bank ok');
assert(!railOk('NGN', PaymentMethodType.CRYPTO), 'NGN crypto not ok');
assert(railOk('USDC', PaymentMethodType.CRYPTO), 'USDC crypto ok');
assert(!railOk('USD', PaymentMethodType.CRYPTO), 'USD crypto not ok');
assert(paymentProviderLabel(PaymentProvider.NOMBA).includes('NGN'), 'Nomba label');
assert(paymentProviderLabel(PaymentProvider.NOAH).includes('Noah'), 'Noah label');
assert(!isCryptoCurrency('SOL'), 'SOL dropped from supported crypto');
