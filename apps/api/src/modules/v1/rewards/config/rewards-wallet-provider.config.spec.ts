import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { resolveRewardsWalletPaymentProvider } from './rewards-wallet-provider.config';

describe('resolveRewardsWalletPaymentProvider', () => {
  const originalNgProvider = process.env.NG_PAYROLL_PROVIDER;
  const originalNgLegacyProvider = process.env.NG_PAYMENTS_PROVIDER;
  const originalNgWalletProvider = process.env.NG_REWARDS_DEPOSIT_PROVIDER;
  const originalNgWalletLegacy = process.env.NG_WALLET_PAYMENTS_PROVIDER;
  const originalBachsKey = process.env.BACHS_SECRET_KEY;
  const originalBachsWalletUsd = process.env.BACHS_WALLET_TOPUP_PRODUCT_USD;
  const originalBachsWalletNgn = process.env.BACHS_WALLET_TOPUP_PRODUCT_NGN;

  const originalIntlProvider = process.env.INTL_REWARDS_DEPOSIT_PROVIDER;
  const originalFincraPublicKey = process.env.FINCRA_PUBLIC_KEY;
  const originalFincraBusinessId = process.env.FINCRA_BUSINESS_ID;

  afterEach(() => {
    if (originalNgProvider === undefined) {
      delete process.env.NG_PAYROLL_PROVIDER;
    } else {
      process.env.NG_PAYROLL_PROVIDER = originalNgProvider;
    }
    if (originalNgLegacyProvider === undefined) {
      delete process.env.NG_PAYMENTS_PROVIDER;
    } else {
      process.env.NG_PAYMENTS_PROVIDER = originalNgLegacyProvider;
    }
    if (originalNgWalletProvider === undefined) {
      delete process.env.NG_REWARDS_DEPOSIT_PROVIDER;
    } else {
      process.env.NG_REWARDS_DEPOSIT_PROVIDER = originalNgWalletProvider;
    }
    if (originalNgWalletLegacy === undefined) {
      delete process.env.NG_WALLET_PAYMENTS_PROVIDER;
    } else {
      process.env.NG_WALLET_PAYMENTS_PROVIDER = originalNgWalletLegacy;
    }
    if (originalBachsKey === undefined) {
      delete process.env.BACHS_SECRET_KEY;
    } else {
      process.env.BACHS_SECRET_KEY = originalBachsKey;
    }
    if (originalBachsWalletUsd === undefined) {
      delete process.env.BACHS_WALLET_TOPUP_PRODUCT_USD;
    } else {
      process.env.BACHS_WALLET_TOPUP_PRODUCT_USD = originalBachsWalletUsd;
    }
    if (originalBachsWalletNgn === undefined) {
      delete process.env.BACHS_WALLET_TOPUP_PRODUCT_NGN;
    } else {
      process.env.BACHS_WALLET_TOPUP_PRODUCT_NGN = originalBachsWalletNgn;
    }
    if (originalIntlProvider === undefined) {
      delete process.env.INTL_REWARDS_DEPOSIT_PROVIDER;
    } else {
      process.env.INTL_REWARDS_DEPOSIT_PROVIDER = originalIntlProvider;
    }
    if (originalFincraPublicKey === undefined) {
      delete process.env.FINCRA_PUBLIC_KEY;
    } else {
      process.env.FINCRA_PUBLIC_KEY = originalFincraPublicKey;
    }
    if (originalFincraBusinessId === undefined) {
      delete process.env.FINCRA_BUSINESS_ID;
    } else {
      process.env.FINCRA_BUSINESS_ID = originalFincraBusinessId;
    }
  });

  it('uses Nomba when tenant country is NG and NG_PAYROLL_PROVIDER=nomba', () => {
    process.env.NG_PAYROLL_PROVIDER = 'nomba';
    expect(resolveRewardsWalletPaymentProvider('NG')).toBe(PaymentProvider.NOMBA);
    expect(resolveRewardsWalletPaymentProvider('NG', 'USD')).toBe(PaymentProvider.NOMBA);
  });

  it('uses Monnify when tenant country is NG and NG_PAYROLL_PROVIDER=monnify', () => {
    process.env.NG_PAYROLL_PROVIDER = 'monnify';
    expect(resolveRewardsWalletPaymentProvider('NG')).toBe(PaymentProvider.MONNIFY);
  });

  it('uses Bachs for wallet deposits when NG_REWARDS_DEPOSIT_PROVIDER=bachs', () => {
    process.env.NG_PAYROLL_PROVIDER = 'nomba';
    process.env.NG_REWARDS_DEPOSIT_PROVIDER = 'bachs';
    process.env.BACHS_SECRET_KEY = 'sk_sandbox_test';
    process.env.BACHS_WALLET_TOPUP_PRODUCT_NGN = 'prod_ngn_wallet';
    expect(resolveRewardsWalletPaymentProvider('NG')).toBe(PaymentProvider.BACHS);
  });

  it('keeps wallet deposits on the same Nomba↔Monnify peer as payroll', () => {
    process.env.NG_PAYROLL_PROVIDER = 'monnify';
    delete process.env.NG_REWARDS_DEPOSIT_PROVIDER;
    delete process.env.NG_WALLET_PAYMENTS_PROVIDER;
    expect(resolveRewardsWalletPaymentProvider('NG')).toBe(PaymentProvider.MONNIFY);
  });

  it('uses Nomba/Monnify when wallet currency is NGN regardless of tenant country', () => {
    process.env.NG_PAYROLL_PROVIDER = 'nomba';
    expect(resolveRewardsWalletPaymentProvider('US', 'NGN')).toBe(PaymentProvider.NOMBA);
    expect(resolveRewardsWalletPaymentProvider('GB', 'ngn')).toBe(PaymentProvider.NOMBA);
  });

  it('uses Noah for non-NG tenant countries with non-NGN wallet currency', () => {
    expect(resolveRewardsWalletPaymentProvider('US')).toBe(PaymentProvider.NOAH);
    expect(resolveRewardsWalletPaymentProvider('US', 'USD')).toBe(PaymentProvider.NOAH);
    expect(resolveRewardsWalletPaymentProvider('GB', 'GBP')).toBe(PaymentProvider.NOAH);
  });

  it('uses Fincra for NG when NG_PAYROLL_PROVIDER=fincra', () => {
    process.env.NG_PAYROLL_PROVIDER = 'fincra';
    process.env.FINCRA_PUBLIC_KEY = 'key';
    expect(resolveRewardsWalletPaymentProvider('NG')).toBe(PaymentProvider.FINCRA);
  });

  it('uses Fincra for international wallet when INTL_REWARDS_DEPOSIT_PROVIDER=fincra', () => {
    process.env.INTL_REWARDS_DEPOSIT_PROVIDER = 'fincra';
    process.env.FINCRA_PUBLIC_KEY = 'key';
    expect(resolveRewardsWalletPaymentProvider('US', 'EUR')).toBe(PaymentProvider.FINCRA);
  });

  it('uses Bachs for USD wallet when Bachs wallet product is configured', () => {
    process.env.BACHS_SECRET_KEY = 'sk_sandbox_test';
    process.env.BACHS_WALLET_TOPUP_PRODUCT_USD = 'prod_usd_wallet';
    expect(resolveRewardsWalletPaymentProvider('US', 'USD')).toBe(PaymentProvider.BACHS);
  });
});
