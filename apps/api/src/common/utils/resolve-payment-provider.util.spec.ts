import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentMethodType } from '../enums/payment-type.enum';
import { paymentProviderLabel, resolvePaymentProvider } from './resolve-payment-provider.util';

describe('resolvePaymentProvider', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    process.env.NOAH_API_KEY = 'test-key';
    delete process.env.INTL_PAYROLL_PROVIDER;
  });

  afterAll(() => {
    process.env = env;
  });

  it('routes NGN fiat to Nomba', () => {
    expect(resolvePaymentProvider('NGN')).toBe(PaymentProvider.NOMBA);
  });

  it('routes USD and GBP fiat to Noah by default', () => {
    expect(resolvePaymentProvider('USD')).toBe(PaymentProvider.NOAH);
    expect(resolvePaymentProvider('GBP')).toBe(PaymentProvider.NOAH);
  });

  it('routes stablecoin crypto to Noah', () => {
    expect(resolvePaymentProvider('USDC')).toBe(PaymentProvider.NOAH);
    expect(resolvePaymentProvider('USDT')).toBe(PaymentProvider.NOAH);
  });

  it('routes BTC ETH SOL to Noah when configured', () => {
    expect(resolvePaymentProvider('BTC')).toBe(PaymentProvider.NOAH);
    expect(resolvePaymentProvider('ETH')).toBe(PaymentProvider.NOAH);
    expect(resolvePaymentProvider('SOL')).toBe(PaymentProvider.NOAH);
  });

  it('routes CRYPTO method type to intl provider even for NG tenant currency', () => {
    expect(resolvePaymentProvider('NGN', PaymentMethodType.CRYPTO)).toBe(PaymentProvider.NOAH);
  });

  it('labels providers', () => {
    expect(paymentProviderLabel(PaymentProvider.NOMBA)).toBe('Local bank transfer');
    expect(paymentProviderLabel(PaymentProvider.NOAH)).toBe('International transfer');
    expect(paymentProviderLabel(PaymentProvider.FINCRA)).toBe('Fincra transfer');
  });
});
