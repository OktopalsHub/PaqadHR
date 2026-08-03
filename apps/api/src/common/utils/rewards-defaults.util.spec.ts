import {
  isWalletCurrencyLocked,
  resolveDefaultRewardsCatalogCountry,
  resolveInitialWalletCurrency,
} from './rewards-defaults.util';

describe('resolveInitialWalletCurrency', () => {
  it('returns NGN for Nigeria regardless of preferred currency', () => {
    expect(resolveInitialWalletCurrency('NG', 'USD')).toBe('NGN');
  });

  it('returns preferred currency for non-Nigeria when set', () => {
    expect(resolveInitialWalletCurrency('US', 'EUR')).toBe('EUR');
    expect(resolveInitialWalletCurrency('GB', 'GBP')).toBe('GBP');
  });

  it('returns USD for non-Nigeria when preferred currency is unset', () => {
    expect(resolveInitialWalletCurrency('US', null)).toBe('USD');
  });
});

describe('isWalletCurrencyLocked', () => {
  it('locks when balance is non-zero', () => {
    expect(isWalletCurrencyLocked({ balanceAmount: 5000 }, 0)).toBe(true);
  });

  it('locks when any transaction exists even at zero balance', () => {
    expect(isWalletCurrencyLocked({ balanceAmount: 0 }, 1)).toBe(true);
  });

  it('is unlocked for empty wallet with no transactions', () => {
    expect(isWalletCurrencyLocked({ balanceAmount: 0 }, 0)).toBe(false);
  });
});

describe('resolveDefaultRewardsCatalogCountry', () => {
  it('prefers tenant country over creator country', () => {
    expect(
      resolveDefaultRewardsCatalogCountry({
        tenantCountryCode: 'NG',
        creatorCountryCode: 'US',
      }),
    ).toBe('NG');
  });
});
