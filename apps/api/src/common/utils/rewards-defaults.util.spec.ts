import {
  isNigeriaWorkspace,
  isWalletCurrencyLocked,
  normalizeRewardsCatalogCountries,
  resolveDefaultRewardsCatalogCountry,
  resolveGiftCardProvider,
  resolveGiftCardProviderFromEnv,
  resolveGiftCatalogProviders,
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

describe('normalizeRewardsCatalogCountries', () => {
  it('defaults to the tenant country when empty', () => {
    expect(normalizeRewardsCatalogCountries([], 'NG')).toEqual(['NG']);
    expect(normalizeRewardsCatalogCountries(null, 'US')).toEqual(['US']);
  });

  it('always includes the tenant country even when only other countries are selected', () => {
    expect(normalizeRewardsCatalogCountries(['US', 'GB'], 'NG')).toEqual(['NG', 'US', 'GB']);
  });

  it('dedupes and normalizes codes', () => {
    expect(normalizeRewardsCatalogCountries(['us', 'US', 'gb'], 'NG')).toEqual(['NG', 'US', 'GB']);
  });
});

describe('isNigeriaWorkspace', () => {
  it('is true only for Nigeria', () => {
    expect(isNigeriaWorkspace('NG')).toBe(true);
    expect(isNigeriaWorkspace('US')).toBe(false);
    expect(isNigeriaWorkspace(null)).toBe(false);
  });
});

describe('resolveGiftCardProviderFromEnv', () => {
  const original = process.env.REWARDS_GIFT_CARD_PROVIDER;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.REWARDS_GIFT_CARD_PROVIDER;
    } else {
      process.env.REWARDS_GIFT_CARD_PROVIDER = original;
    }
  });

  it('defaults to tremendous', () => {
    delete process.env.REWARDS_GIFT_CARD_PROVIDER;
    expect(resolveGiftCardProviderFromEnv()).toBe('tremendous');
    expect(resolveGiftCardProviderFromEnv('')).toBe('tremendous');
    expect(resolveGiftCardProviderFromEnv('tremendous')).toBe('tremendous');
  });

  it('returns reloadly when set', () => {
    expect(resolveGiftCardProviderFromEnv('reloadly')).toBe('reloadly');
    expect(resolveGiftCardProviderFromEnv(' RELOADLY ')).toBe('reloadly');
  });
});

describe('resolveGiftCatalogProviders', () => {
  const original = process.env.REWARDS_GIFT_CARD_PROVIDER;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.REWARDS_GIFT_CARD_PROVIDER;
    } else {
      process.env.REWARDS_GIFT_CARD_PROVIDER = original;
    }
  });

  it('uses the environment provider for every workspace', () => {
    process.env.REWARDS_GIFT_CARD_PROVIDER = 'tremendous';
    expect(resolveGiftCatalogProviders('NG', 'reloadly')).toEqual(['tremendous']);
    expect(resolveGiftCatalogProviders('US', 'reloadly')).toEqual(['tremendous']);

    process.env.REWARDS_GIFT_CARD_PROVIDER = 'reloadly';
    expect(resolveGiftCatalogProviders('NG')).toEqual(['reloadly']);
    expect(resolveGiftCatalogProviders('GB')).toEqual(['reloadly']);
  });
});

describe('resolveGiftCardProvider', () => {
  it('ignores tenant selection and reads env', () => {
    const original = process.env.REWARDS_GIFT_CARD_PROVIDER;
    process.env.REWARDS_GIFT_CARD_PROVIDER = 'reloadly';
    expect(resolveGiftCardProvider('tremendous')).toBe('reloadly');
    if (original === undefined) {
      delete process.env.REWARDS_GIFT_CARD_PROVIDER;
    } else {
      process.env.REWARDS_GIFT_CARD_PROVIDER = original;
    }
  });
});
