import {
  defaultPayrollCurrency,
  getNombaParentAccountId,
  getNombaPayoutCurrencies,
  getNombaScopedAccountId,
  isNombaGlobalPayoutEnabled,
  isNombaLive,
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

describe('nomba.config live mode', () => {
  const original = process.env.NOMBA_LIVE;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NOMBA_LIVE;
    } else {
      process.env.NOMBA_LIVE = original;
    }
  });

  it('is false by default', () => {
    delete process.env.NOMBA_LIVE;
    expect(isNombaLive()).toBe(false);
  });

  it('is true when NOMBA_LIVE=true', () => {
    process.env.NOMBA_LIVE = 'true';
    expect(isNombaLive()).toBe(true);
  });
});

describe('nomba.config parent/sub accounts', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('uses NOMBA_ACCOUNT_ID as parent when NOMBA_PARENT_ACCOUNT_ID is unset', () => {
    process.env.NOMBA_ACCOUNT_ID = 'parent-id';
    delete process.env.NOMBA_PARENT_ACCOUNT_ID;
    expect(getNombaParentAccountId()).toBe('parent-id');
  });

  it('prefers NOMBA_PARENT_ACCOUNT_ID over NOMBA_ACCOUNT_ID', () => {
    process.env.NOMBA_PARENT_ACCOUNT_ID = 'explicit-parent';
    process.env.NOMBA_ACCOUNT_ID = 'legacy-parent';
    expect(getNombaParentAccountId()).toBe('explicit-parent');
  });

  it('scopes money movement to sub-account when configured', () => {
    process.env.NOMBA_PARENT_ACCOUNT_ID = 'parent-id';
    process.env.NOMBA_SUB_ACCOUNT_ID = 'sub-id';
    expect(getNombaScopedAccountId()).toBe('sub-id');
  });
});
