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

/** Native assets must be refused at routing time rather than sent to a provider that cannot pay them. */
function throwsUnsupported(run: () => unknown): boolean {
  try {
    run();
    return false;
  } catch {
    return true;
  }
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
assert(paymentProviderLabel(PaymentProvider.NOMBA).includes('Local bank'), 'Nomba label');
assert(paymentProviderLabel(PaymentProvider.NOAH).includes('International'), 'Noah label');
assert(isCryptoCurrency('USDT'), 'USDT is supported crypto');
assert(isCryptoCurrency('USDC'), 'USDC is supported crypto');
assert(isCryptoCurrency('SOL') === false, 'SOL is no longer a supported crypto currency');
assert(isCryptoCurrency('BTC') === false, 'BTC is no longer a supported crypto currency');
assert(isCryptoCurrency('ETH') === false, 'ETH is no longer a supported crypto currency');
assert(isCryptoCurrency('GBP') === false, 'GBP is fiat not crypto');
assert(
  throwsUnsupported(() => resolvePaymentProvider('SOL')),
  'SOL → rejected at routing',
);
assert(
  throwsUnsupported(() => resolvePaymentProvider('BTC')),
  'BTC → rejected at routing',
);
