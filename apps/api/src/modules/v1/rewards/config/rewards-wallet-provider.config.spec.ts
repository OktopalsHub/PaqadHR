import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { resolveRewardsWalletPaymentProvider } from './rewards-wallet-provider.config';

describe('resolveRewardsWalletPaymentProvider', () => {
  const originalNgProvider = process.env.NG_PAYMENTS_PROVIDER;

  afterEach(() => {
    if (originalNgProvider === undefined) {
      delete process.env.NG_PAYMENTS_PROVIDER;
    } else {
      process.env.NG_PAYMENTS_PROVIDER = originalNgProvider;
    }
  });

  it('uses Nomba when tenant country is NG and NG_PAYMENTS_PROVIDER=nomba', () => {
    process.env.NG_PAYMENTS_PROVIDER = 'nomba';
    expect(resolveRewardsWalletPaymentProvider('NG')).toBe(PaymentProvider.NOMBA);
    expect(resolveRewardsWalletPaymentProvider('NG', 'USD')).toBe(PaymentProvider.NOMBA);
  });

  it('uses Monnify when tenant country is NG and NG_PAYMENTS_PROVIDER=monnify', () => {
    process.env.NG_PAYMENTS_PROVIDER = 'monnify';
    expect(resolveRewardsWalletPaymentProvider('NG')).toBe(PaymentProvider.MONNIFY);
  });

  it('uses Nomba/Monnify when wallet currency is NGN regardless of tenant country', () => {
    process.env.NG_PAYMENTS_PROVIDER = 'nomba';
    expect(resolveRewardsWalletPaymentProvider('US', 'NGN')).toBe(PaymentProvider.NOMBA);
    expect(resolveRewardsWalletPaymentProvider('GB', 'ngn')).toBe(PaymentProvider.NOMBA);
  });

  it('uses Noah for non-NG tenant countries with non-NGN wallet currency', () => {
    expect(resolveRewardsWalletPaymentProvider('US')).toBe(PaymentProvider.NOAH);
    expect(resolveRewardsWalletPaymentProvider('US', 'USD')).toBe(PaymentProvider.NOAH);
    expect(resolveRewardsWalletPaymentProvider('GB', 'GBP')).toBe(PaymentProvider.NOAH);
  });
});
