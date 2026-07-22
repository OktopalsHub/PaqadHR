import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentMethodType } from '../enums/payment-type.enum';
import { paymentProviderLabel, resolvePaymentProvider } from './resolve-payment-provider.util';

describe('resolvePaymentProvider', () => {
  it('routes NGN fiat to Nomba', () => {
    expect(resolvePaymentProvider('NGN')).toBe(PaymentProvider.NOMBA);
  });

  it('routes USD fiat to Noah', () => {
    expect(resolvePaymentProvider('USD')).toBe(PaymentProvider.NOAH);
  });

  it('routes crypto to Noah', () => {
    expect(resolvePaymentProvider('USDC')).toBe(PaymentProvider.NOAH);
    expect(resolvePaymentProvider('BTC', PaymentMethodType.BANK)).toBe(PaymentProvider.NOAH);
  });

  it('routes CRYPTO method type to Noah even for NG tenant currency', () => {
    expect(resolvePaymentProvider('NGN', PaymentMethodType.CRYPTO)).toBe(PaymentProvider.NOAH);
  });

  it('labels providers', () => {
    expect(paymentProviderLabel(PaymentProvider.NOMBA)).toBe('Local bank (NGN)');
    expect(paymentProviderLabel(PaymentProvider.NOAH)).toBe('International / crypto (Noah)');
  });
});
