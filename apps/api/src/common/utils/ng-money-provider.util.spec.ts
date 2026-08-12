import { PaymentProvider } from '../enums/payment-provider.enum';
import {
  getNgPaymentsProviderPreference,
  getNgWalletPaymentsProviderPreference,
  resolveNgPaymentProvider,
  resolveNgWalletPaymentProvider,
} from './ng-money-provider.util';

describe('ng-money-provider.util', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.NG_PAYMENTS_PROVIDER;
    delete process.env.NG_WALLET_PAYMENTS_PROVIDER;
    delete process.env.BILLING_NG_PROVIDER;
    delete process.env.MONNIFY_API_KEY;
    delete process.env.MONNIFY_SECRET_KEY;
    delete process.env.MONNIFY_CONTRACT_CODE;
    delete process.env.BACHS_SECRET_KEY;
    delete process.env.BACHS_WALLET_TOPUP_PRODUCT_NGN;
    delete process.env.NOMBA_CLIENT_ID;
    delete process.env.NOMBA_CLIENT_SECRET;
    delete process.env.NOMBA_PARENT_ACCOUNT_ID;
  });

  afterAll(() => {
    process.env = env;
  });

  it('defaults NG money rails to nomba', () => {
    expect(getNgPaymentsProviderPreference()).toBe('nomba');
    expect(resolveNgPaymentProvider()).toBe(PaymentProvider.NOMBA);
    expect(resolveNgWalletPaymentProvider()).toBe(PaymentProvider.NOMBA);
  });

  it('uses one NG_PAYMENTS_PROVIDER switch for payroll and wallet deposits', () => {
    process.env.NG_PAYMENTS_PROVIDER = 'monnify';
    process.env.MONNIFY_API_KEY = 'key';
    process.env.MONNIFY_SECRET_KEY = 'secret';
    process.env.MONNIFY_CONTRACT_CODE = 'contract';

    expect(getNgPaymentsProviderPreference()).toBe('monnify');
    expect(resolveNgPaymentProvider()).toBe(PaymentProvider.MONNIFY);
    expect(resolveNgWalletPaymentProvider()).toBe(PaymentProvider.MONNIFY);
  });

  it('falls back to nomba when monnify is preferred but not configured', () => {
    process.env.NG_PAYMENTS_PROVIDER = 'monnify';
    process.env.NOMBA_CLIENT_ID = 'id';
    process.env.NOMBA_CLIENT_SECRET = 'secret';
    process.env.NOMBA_PARENT_ACCOUNT_ID = 'parent';

    expect(resolveNgPaymentProvider()).toBe(PaymentProvider.NOMBA);
    expect(resolveNgWalletPaymentProvider()).toBe(PaymentProvider.NOMBA);
  });

  it('never routes NGN payroll to Bachs even if NG_PAYMENTS_PROVIDER=bachs', () => {
    process.env.NG_PAYMENTS_PROVIDER = 'bachs';
    process.env.NOMBA_CLIENT_ID = 'id';
    process.env.NOMBA_CLIENT_SECRET = 'secret';
    process.env.NOMBA_PARENT_ACCOUNT_ID = 'parent';

    expect(resolveNgPaymentProvider()).toBe(PaymentProvider.NOMBA);
  });

  it('overrides wallet deposits to Bachs without changing payroll rail', () => {
    process.env.NG_PAYMENTS_PROVIDER = 'monnify';
    process.env.NG_WALLET_PAYMENTS_PROVIDER = 'bachs';
    process.env.MONNIFY_API_KEY = 'key';
    process.env.MONNIFY_SECRET_KEY = 'secret';
    process.env.MONNIFY_CONTRACT_CODE = 'contract';
    process.env.BACHS_SECRET_KEY = 'sk_sandbox_test';
    process.env.BACHS_WALLET_TOPUP_PRODUCT_NGN = 'prod_ngn';

    expect(getNgWalletPaymentsProviderPreference()).toBe('bachs');
    expect(resolveNgWalletPaymentProvider()).toBe(PaymentProvider.BACHS);
    expect(resolveNgPaymentProvider()).toBe(PaymentProvider.MONNIFY);
  });
});
