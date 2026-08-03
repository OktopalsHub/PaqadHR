import { PaymentProvider } from '../enums/payment-provider.enum';
import {
  getNgPaymentsProviderPreference,
  resolveNgPaymentProvider,
} from './ng-money-provider.util';

describe('ng-money-provider.util', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.NG_PAYMENTS_PROVIDER;
    delete process.env.BILLING_NG_PROVIDER;
    delete process.env.MONNIFY_API_KEY;
    delete process.env.MONNIFY_SECRET_KEY;
    delete process.env.MONNIFY_CONTRACT_CODE;
  });

  afterAll(() => {
    process.env = env;
  });

  it('defaults NG payments to nomba', () => {
    expect(getNgPaymentsProviderPreference()).toBe('nomba');
    expect(resolveNgPaymentProvider()).toBe(PaymentProvider.NOMBA);
  });

  it('uses NG_PAYMENTS_PROVIDER independently of BILLING_NG_PROVIDER', () => {
    process.env.BILLING_NG_PROVIDER = 'bachs';
    process.env.NG_PAYMENTS_PROVIDER = 'monnify';
    process.env.MONNIFY_API_KEY = 'key';
    process.env.MONNIFY_SECRET_KEY = 'secret';
    process.env.MONNIFY_CONTRACT_CODE = 'contract';

    expect(getNgPaymentsProviderPreference()).toBe('monnify');
    expect(resolveNgPaymentProvider()).toBe(PaymentProvider.MONNIFY);
  });

  it('falls back to nomba when monnify is preferred but not configured', () => {
    process.env.NG_PAYMENTS_PROVIDER = 'monnify';
    process.env.NOMBA_CLIENT_ID = 'id';
    process.env.NOMBA_CLIENT_SECRET = 'secret';
    process.env.NOMBA_PARENT_ACCOUNT_ID = 'parent';

    expect(resolveNgPaymentProvider()).toBe(PaymentProvider.NOMBA);
  });
});
