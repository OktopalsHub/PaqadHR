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
  });

  it('uses Monnify when tenant country is NG and NG_PAYMENTS_PROVIDER=monnify', () => {
    process.env.NG_PAYMENTS_PROVIDER = 'monnify';
    expect(resolveRewardsWalletPaymentProvider('NG')).toBe(PaymentProvider.MONNIFY);
  });

  it('uses Noah for non-NG tenant countries regardless of wallet currency', () => {
    expect(resolveRewardsWalletPaymentProvider('US')).toBe(PaymentProvider.NOAH);
    expect(resolveRewardsWalletPaymentProvider('GB')).toBe(PaymentProvider.NOAH);
  });
});
