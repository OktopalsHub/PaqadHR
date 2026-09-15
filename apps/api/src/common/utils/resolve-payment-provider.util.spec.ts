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

  it('routes USDT on Bachs networks to Bachs regardless of intl preference', () => {
    process.env.BACHS_SECRET_KEY = 'sk_sandbox_test';
    process.env.NOAH_API_KEY = 'test-key';
    process.env.INTL_PAYROLL_PROVIDER = 'noah';

    expect(resolvePaymentProvider('USDT', undefined, 'TRC20')).toBe(PaymentProvider.BACHS);
    expect(resolvePaymentProvider('USDT', undefined, 'bep20')).toBe(PaymentProvider.BACHS);
  });

  it('routes USDT on Bachs networks to Bachs even when Bachs is not configured', () => {
    // Fails loudly in the provider rather than falling back to a rail that would
    // settle USDT on a different chain.
    delete process.env.BACHS_SECRET_KEY;

    expect(resolvePaymentProvider('USDT', undefined, 'TRC20')).toBe(PaymentProvider.BACHS);
  });

  it('keeps Ethereum USDT and USD bank payouts on the intl provider', () => {
    process.env.BACHS_SECRET_KEY = 'sk_sandbox_test';
    process.env.NOAH_API_KEY = 'test-key';
    process.env.INTL_PAYROLL_PROVIDER = 'bachs';

    expect(resolvePaymentProvider('USDT', undefined, 'Ethereum')).toBe(PaymentProvider.NOAH);
    expect(resolvePaymentProvider('USDT')).toBe(PaymentProvider.NOAH);
    expect(resolvePaymentProvider('USD')).toBe(PaymentProvider.NOAH);
    expect(resolvePaymentProvider('EUR')).toBe(PaymentProvider.NOAH);
  });

  it('labels providers', () => {
    expect(paymentProviderLabel(PaymentProvider.NOMBA)).toBe('Local bank transfer');
    expect(paymentProviderLabel(PaymentProvider.NOAH)).toBe('International transfer');
    expect(paymentProviderLabel(PaymentProvider.FINCRA)).toBe('Fincra transfer');
    expect(paymentProviderLabel(PaymentProvider.BACHS)).toBe('Bachs transfer');
  });
});
