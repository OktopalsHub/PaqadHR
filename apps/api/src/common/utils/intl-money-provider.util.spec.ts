import { PaymentProvider } from '../enums/payment-provider.enum';
import {
  getIntlPayrollProviderPreference,
  getIntlRewardsDepositProviderPreference,
  resolveIntlPaymentProvider,
  resolveIntlWalletPaymentProvider,
} from './intl-money-provider.util';

describe('intl-money-provider.util', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.INTL_PAYROLL_PROVIDER;
    delete process.env.INTL_REWARDS_DEPOSIT_PROVIDER;
    delete process.env.NOAH_API_KEY;
    delete process.env.FINCRA_API_KEY;
    delete process.env.FINCRA_PUBLIC_KEY;
    delete process.env.FINCRA_BUSINESS_ID;
  });

  afterAll(() => {
    process.env = env;
  });

  it('defaults to noah', () => {
    process.env.NOAH_API_KEY = 'noah-key';
    expect(getIntlPayrollProviderPreference()).toBe('noah');
    expect(resolveIntlPaymentProvider()).toBe(PaymentProvider.NOAH);
    expect(resolveIntlWalletPaymentProvider()).toBe(PaymentProvider.NOAH);
  });

  it('routes to fincra when preferred and configured', () => {
    process.env.INTL_PAYROLL_PROVIDER = 'fincra';
    process.env.INTL_REWARDS_DEPOSIT_PROVIDER = 'fincra';
    process.env.FINCRA_API_KEY = 'key';

    expect(getIntlPayrollProviderPreference()).toBe('fincra');
    expect(getIntlRewardsDepositProviderPreference()).toBe('fincra');
    expect(resolveIntlPaymentProvider()).toBe(PaymentProvider.FINCRA);
    expect(resolveIntlWalletPaymentProvider()).toBe(PaymentProvider.FINCRA);
  });

  it('falls back from fincra to noah when fincra is not configured', () => {
    process.env.INTL_PAYROLL_PROVIDER = 'fincra';
    process.env.NOAH_API_KEY = 'noah-key';
    expect(resolveIntlPaymentProvider()).toBe(PaymentProvider.NOAH);
  });

  it('routes intl payroll to Bachs when preferred and configured', () => {
    process.env.INTL_PAYROLL_PROVIDER = 'bachs';
    process.env.BACHS_SECRET_KEY = 'sk_sandbox_test';
    process.env.NOAH_API_KEY = 'noah-key';

    expect(getIntlPayrollProviderPreference()).toBe('bachs');
    expect(resolveIntlPaymentProvider()).toBe(PaymentProvider.BACHS);
    // Rewards wallet checkout does not follow the Bachs payroll rail.
    expect(resolveIntlWalletPaymentProvider()).toBe(PaymentProvider.NOAH);
  });

  it('falls back from bachs to noah when Bachs is not configured', () => {
    process.env.INTL_PAYROLL_PROVIDER = 'bachs';
    delete process.env.BACHS_SECRET_KEY;
    process.env.NOAH_API_KEY = 'noah-key';
    expect(resolveIntlPaymentProvider()).toBe(PaymentProvider.NOAH);
  });
});
