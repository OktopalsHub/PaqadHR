import { PaymentProvider } from '../enums/payment-provider.enum';
import {
  getNgPaymentsProviderPreference,
  getNgPayrollProviderPreference,
  getNgRewardsAirtimeProviderPreference,
  getNgRewardsDepositProviderPreference,
  getNgWalletPaymentsProviderPreference,
  resolveNgPaymentProvider,
  resolveNgRewardsAirtimeProvider,
  resolveNgWalletPaymentProvider,
} from './ng-money-provider.util';

describe('ng-money-provider.util', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.NG_PAYROLL_PROVIDER;
    delete process.env.NG_PAYMENTS_PROVIDER;
    delete process.env.NG_REWARDS_DEPOSIT_PROVIDER;
    delete process.env.NG_WALLET_PAYMENTS_PROVIDER;
    delete process.env.NG_REWARDS_AIRTIME_PROVIDER;
    delete process.env.BILLING_NG_PROVIDER;
    delete process.env.MONNIFY_API_KEY;
    delete process.env.MONNIFY_SECRET_KEY;
    delete process.env.MONNIFY_CONTRACT_CODE;
    delete process.env.BACHS_SECRET_KEY;
    delete process.env.BACHS_WALLET_TOPUP_PRODUCT_NGN;
    delete process.env.NOMBA_CLIENT_ID;
    delete process.env.NOMBA_CLIENT_SECRET;
    delete process.env.NOMBA_PARENT_ACCOUNT_ID;
    delete process.env.FINCRA_API_KEY;
    delete process.env.FINCRA_PUBLIC_KEY;
    delete process.env.FINCRA_BUSINESS_ID;
  });

  afterAll(() => {
    process.env = env;
  });

  it('defaults NG money rails to nomba', () => {
    expect(getNgPayrollProviderPreference()).toBe('nomba');
    expect(getNgPaymentsProviderPreference()).toBe('nomba');
    expect(resolveNgPaymentProvider()).toBe(PaymentProvider.NOMBA);
    expect(resolveNgWalletPaymentProvider()).toBe(PaymentProvider.NOMBA);
    expect(getNgRewardsAirtimeProviderPreference()).toBe('nomba');
    expect(resolveNgRewardsAirtimeProvider()).toBe(PaymentProvider.NOMBA);
  });

  it('uses NG_PAYROLL_PROVIDER for payroll and empty deposit follows payroll', () => {
    process.env.NG_PAYROLL_PROVIDER = 'monnify';
    process.env.MONNIFY_API_KEY = 'key';
    process.env.MONNIFY_SECRET_KEY = 'secret';
    process.env.MONNIFY_CONTRACT_CODE = 'contract';

    expect(getNgPayrollProviderPreference()).toBe('monnify');
    expect(resolveNgPaymentProvider()).toBe(PaymentProvider.MONNIFY);
    expect(getNgRewardsDepositProviderPreference()).toBe('monnify');
    expect(resolveNgWalletPaymentProvider()).toBe(PaymentProvider.MONNIFY);
  });

  it('falls back to legacy NG_PAYMENTS_PROVIDER / NG_WALLET_PAYMENTS_PROVIDER', () => {
    process.env.NG_PAYMENTS_PROVIDER = 'monnify';
    process.env.NG_WALLET_PAYMENTS_PROVIDER = 'bachs';
    process.env.MONNIFY_API_KEY = 'key';
    process.env.MONNIFY_SECRET_KEY = 'secret';
    process.env.MONNIFY_CONTRACT_CODE = 'contract';
    process.env.BACHS_SECRET_KEY = 'sk_sandbox_test';
    process.env.BACHS_WALLET_TOPUP_PRODUCT_NGN = 'prod_ngn';

    expect(getNgPayrollProviderPreference()).toBe('monnify');
    expect(getNgWalletPaymentsProviderPreference()).toBe('bachs');
    expect(resolveNgWalletPaymentProvider()).toBe(PaymentProvider.BACHS);
  });

  it('falls back to nomba when monnify is preferred but not configured', () => {
    process.env.NG_PAYROLL_PROVIDER = 'monnify';
    process.env.NOMBA_CLIENT_ID = 'id';
    process.env.NOMBA_CLIENT_SECRET = 'secret';
    process.env.NOMBA_PARENT_ACCOUNT_ID = 'parent';

    expect(resolveNgPaymentProvider()).toBe(PaymentProvider.NOMBA);
    expect(resolveNgWalletPaymentProvider()).toBe(PaymentProvider.NOMBA);
  });

  it('never routes NGN payroll to Bachs even if NG_PAYROLL_PROVIDER=bachs', () => {
    process.env.NG_PAYROLL_PROVIDER = 'bachs';
    process.env.NOMBA_CLIENT_ID = 'id';
    process.env.NOMBA_CLIENT_SECRET = 'secret';
    process.env.NOMBA_PARENT_ACCOUNT_ID = 'parent';

    expect(resolveNgPaymentProvider()).toBe(PaymentProvider.NOMBA);
  });

  it('overrides wallet deposits to Bachs without changing payroll rail', () => {
    process.env.NG_PAYROLL_PROVIDER = 'monnify';
    process.env.NG_REWARDS_DEPOSIT_PROVIDER = 'bachs';
    process.env.MONNIFY_API_KEY = 'key';
    process.env.MONNIFY_SECRET_KEY = 'secret';
    process.env.MONNIFY_CONTRACT_CODE = 'contract';
    process.env.BACHS_SECRET_KEY = 'sk_sandbox_test';
    process.env.BACHS_WALLET_TOPUP_PRODUCT_NGN = 'prod_ngn';

    expect(getNgRewardsDepositProviderPreference()).toBe('bachs');
    expect(resolveNgWalletPaymentProvider()).toBe(PaymentProvider.BACHS);
    expect(resolveNgPaymentProvider()).toBe(PaymentProvider.MONNIFY);
  });

  it('routes NGN payroll to fincra when preferred and configured', () => {
    process.env.NG_PAYROLL_PROVIDER = 'fincra';
    process.env.FINCRA_API_KEY = 'key';

    expect(getNgPayrollProviderPreference()).toBe('fincra');
    expect(resolveNgPaymentProvider()).toBe(PaymentProvider.FINCRA);
    expect(resolveNgWalletPaymentProvider()).toBe(PaymentProvider.FINCRA);
  });

  it('falls back from fincra to nomba when fincra is not configured', () => {
    process.env.NG_PAYROLL_PROVIDER = 'fincra';
    process.env.NOMBA_CLIENT_ID = 'id';
    process.env.NOMBA_CLIENT_SECRET = 'secret';
    process.env.NOMBA_PARENT_ACCOUNT_ID = 'parent';

    expect(resolveNgPaymentProvider()).toBe(PaymentProvider.NOMBA);
  });

  it('routes airtime via NG_REWARDS_AIRTIME_PROVIDER independently of payroll', () => {
    process.env.NG_PAYROLL_PROVIDER = 'monnify';
    process.env.NG_REWARDS_AIRTIME_PROVIDER = 'nomba';
    process.env.MONNIFY_API_KEY = 'key';
    process.env.MONNIFY_SECRET_KEY = 'secret';
    process.env.MONNIFY_CONTRACT_CODE = 'contract';
    process.env.NOMBA_CLIENT_ID = 'id';
    process.env.NOMBA_CLIENT_SECRET = 'secret';
    process.env.NOMBA_PARENT_ACCOUNT_ID = 'parent';

    expect(resolveNgPaymentProvider()).toBe(PaymentProvider.MONNIFY);
    expect(getNgRewardsAirtimeProviderPreference()).toBe('nomba');
    expect(resolveNgRewardsAirtimeProvider()).toBe(PaymentProvider.NOMBA);

    process.env.NG_REWARDS_AIRTIME_PROVIDER = 'monnify';
    expect(resolveNgRewardsAirtimeProvider()).toBe(PaymentProvider.MONNIFY);
  });
});
