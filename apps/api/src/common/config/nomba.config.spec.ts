import {
  defaultPayrollCurrency,
  getNombaBaseUrl,
  getNombaParentAccountId,
  getNombaPayoutCurrencies,
  getNombaScopedAccountId,
  isNombaGlobalPayoutEnabled,
  isNombaLive,
  NOMBA_PRODUCTION_BASE_URL,
  NOMBA_SANDBOX_BASE_URL,
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
  const originalLive = process.env.NOMBA_LIVE;
  const originalBase = process.env.NOMBA_BASE_URL;

  afterEach(() => {
    if (originalLive === undefined) {
      delete process.env.NOMBA_LIVE;
    } else {
      process.env.NOMBA_LIVE = originalLive;
    }
    if (originalBase === undefined) {
      delete process.env.NOMBA_BASE_URL;
    } else {
      process.env.NOMBA_BASE_URL = originalBase;
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

  it('uses sandbox host when not live', () => {
    delete process.env.NOMBA_BASE_URL;
    delete process.env.NOMBA_LIVE;
    expect(getNombaBaseUrl()).toBe(NOMBA_SANDBOX_BASE_URL);
  });

  it('uses production host when live', () => {
    delete process.env.NOMBA_BASE_URL;
    process.env.NOMBA_LIVE = 'true';
    expect(getNombaBaseUrl()).toBe(NOMBA_PRODUCTION_BASE_URL);
  });

  it('allows explicit NOMBA_BASE_URL override', () => {
    process.env.NOMBA_LIVE = 'true';
    process.env.NOMBA_BASE_URL = 'https://sandbox.nomba.com/';
    expect(getNombaBaseUrl()).toBe(NOMBA_SANDBOX_BASE_URL);
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
