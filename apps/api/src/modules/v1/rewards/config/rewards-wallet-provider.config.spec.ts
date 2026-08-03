import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { resolveRewardsWalletPaymentProvider } from './rewards-wallet-provider.config';

describe('resolveRewardsWalletPaymentProvider', () => {
  const originalMonnify = process.env.REWARDS_WALLET_NG_PROVIDER;

  afterEach(() => {
    if (originalMonnify === undefined) {
      delete process.env.REWARDS_WALLET_NG_PROVIDER;
    } else {
      process.env.REWARDS_WALLET_NG_PROVIDER = originalMonnify;
    }
  });

  it('uses Nomba/Monnify when tenant country is NG regardless of wallet currency', () => {
    process.env.REWARDS_WALLET_NG_PROVIDER = 'nomba';
    expect(resolveRewardsWalletPaymentProvider('NG')).toBe(PaymentProvider.NOMBA);
  });

  it('uses Noah for non-NG tenant countries regardless of wallet currency', () => {
    expect(resolveRewardsWalletPaymentProvider('US')).toBe(PaymentProvider.NOAH);
    expect(resolveRewardsWalletPaymentProvider('GB')).toBe(PaymentProvider.NOAH);
  });
});
