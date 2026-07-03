import {
  defaultPayrollCurrency,
  getNombaPayoutCurrencies,
  isNombaGlobalPayoutEnabled,
} from './nomba.config';

describe('nomba.config payout currencies', () => {
  const original = process.env.NOMBA_PAYOUT_AUTH_CODE;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NOMBA_PAYOUT_AUTH_CODE;
    } else {
      process.env.NOMBA_PAYOUT_AUTH_CODE = original;
    }
  });

  it('defaults to NGN-only payroll when payout auth code is unset', () => {
    delete process.env.NOMBA_PAYOUT_AUTH_CODE;
    expect(isNombaGlobalPayoutEnabled()).toBe(false);
    expect(getNombaPayoutCurrencies()).toEqual(['NGN']);
    expect(defaultPayrollCurrency()).toBe('NGN');
  });

  it('enables global fiat payouts when payout auth code is set', () => {
    process.env.NOMBA_PAYOUT_AUTH_CODE = 'sandbox-pin';
    expect(isNombaGlobalPayoutEnabled()).toBe(true);
    expect(getNombaPayoutCurrencies()).toEqual(['NGN', 'USD', 'EUR', 'GBP']);
    expect(defaultPayrollCurrency()).toBe('USD');
  });
});
