import {
  isNigeriaWorkspace,
  isWalletCurrencyLocked,
  resolveDefaultRewardsCatalogCountry,
  resolveGiftCardProvider,
  resolveGiftCatalogProviders,
  resolveInitialWalletCurrency,
  resolveRewardsCatalogCountries,
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

  it('returns country default when preferred currency is unset', () => {
    expect(resolveInitialWalletCurrency('GB', null)).toBe('GBP');
    expect(resolveInitialWalletCurrency('DE', null)).toBe('EUR');
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

describe('resolveRewardsCatalogCountries', () => {
  it('does not infer catalog countries from the workspace', () => {
    expect(resolveRewardsCatalogCountries('NG')).toEqual([]);
    expect(resolveRewardsCatalogCountries('US')).toEqual([]);
    expect(resolveRewardsCatalogCountries(null)).toEqual([]);
  });
});

describe('isNigeriaWorkspace', () => {
  it('is true only for Nigeria', () => {
    expect(isNigeriaWorkspace('NG')).toBe(true);
    expect(isNigeriaWorkspace('US')).toBe(false);
    expect(isNigeriaWorkspace(null)).toBe(false);
  });
});

describe('resolveGiftCatalogProviders', () => {
  it('unions Tremendous and Reloadly for Nigeria', () => {
    expect(resolveGiftCatalogProviders('NG', 'tremendous')).toEqual(['tremendous', 'reloadly']);
    expect(resolveGiftCatalogProviders('NG', 'reloadly')).toEqual(['tremendous', 'reloadly']);
  });

  it('uses the selected provider for every other workspace', () => {
    expect(resolveGiftCatalogProviders('US', 'reloadly')).toEqual(['reloadly']);
    expect(resolveGiftCatalogProviders('GB', undefined)).toEqual(['tremendous']);
  });
});

describe('resolveGiftCardProvider', () => {
  it('defaults to tremendous', () => {
    expect(resolveGiftCardProvider(undefined)).toBe('tremendous');
    expect(resolveGiftCardProvider('tremendous')).toBe('tremendous');
  });

  it('returns reloadly when explicitly selected', () => {
    expect(resolveGiftCardProvider('reloadly')).toBe('reloadly');
  });
});
