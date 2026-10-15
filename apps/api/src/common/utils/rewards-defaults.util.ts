import { GeoLocationHelper, getDefaultFiatCurrencyForCountry } from './geo-location.util';

/** Fallback when wallet.currencyCode is missing; matches ensureWallet resolution-failure default. */
export const DEFAULT_WALLET_CURRENCY_FALLBACK = 'USD';

/** Currency for a new or unfunded wallet before any activity. */
export function resolveInitialWalletCurrency(
  tenantCountryCode?: string | null,
  tenantPreferredCurrency?: string | null,
): string {
  const country = GeoLocationHelper.toStoredCountryCode(tenantCountryCode ?? '') ?? '';
  if (country === 'NG') {
    return 'NGN';
  }
  const preferred = tenantPreferredCurrency?.trim().toUpperCase();
  if (preferred) {
    return preferred;
  }
  return getDefaultFiatCurrencyForCountry(country) || DEFAULT_WALLET_CURRENCY_FALLBACK;
}

/** @deprecated Use resolveInitialWalletCurrency for new wallets; funded wallets use tenant_wallets.currency_code. */
export function resolveDefaultRewardsCurrency(
  tenantCountryCode?: string | null,
  tenantPreferredCurrency?: string | null,
): string {
  return resolveInitialWalletCurrency(tenantCountryCode, tenantPreferredCurrency);
}

export function isWalletCurrencyLocked(
  wallet: { balanceAmount: number | string },
  transactionCount: number,
): boolean {
  if (transactionCount > 0) {
    return true;
  }
  return Number(wallet.balanceAmount) !== 0;
}

export type GiftCardProvider = 'tremendous';

export const DEFAULT_GIFT_CARD_PROVIDER: GiftCardProvider = 'tremendous';

/** Platform gift-card provider — always Tremendous. */
export function resolveGiftCardProviderFromEnv(
  _raw: string | undefined = process.env.REWARDS_GIFT_CARD_PROVIDER,
): GiftCardProvider {
  return DEFAULT_GIFT_CARD_PROVIDER;
}

/** @deprecated Prefer resolveGiftCardProviderFromEnv. */
export function resolveGiftCardProvider(_value?: string | null): GiftCardProvider {
  return resolveGiftCardProviderFromEnv();
}

/**
 * Gift catalogs follow the environment-selected provider only.
 */
export function resolveGiftCatalogProviders(
  _tenantCountryCode?: string | null,
  _selected?: string | null,
): GiftCardProvider[] {
  return [resolveGiftCardProviderFromEnv()];
}

export function resolveDefaultRewardsCatalogCountry(options: {
  tenantCountryCode?: string | null;
  creatorCountryCode?: string | null;
}): string {
  return (
    GeoLocationHelper.toStoredCountryCode(options.tenantCountryCode) ??
    GeoLocationHelper.toStoredCountryCode(options.creatorCountryCode) ??
    'US'
  );
}

/**
 * Normalize an allowlist of catalog countries.
 * Always includes `fallbackCountry` (tenant country) when a list is provided or when empty is not allowed.
 */
export function normalizeRewardsCatalogCountries(
  countries: readonly string[] | null | undefined,
  fallbackCountry: string,
  options?: { allowEmpty?: boolean },
): string[] {
  const fallback =
    GeoLocationHelper.toStoredCountryCode(fallbackCountry) ??
    GeoLocationHelper.toStoredCountryCode('US') ??
    'US';

  const normalized = Array.from(
    new Set(
      (countries ?? [])
        .map((code) => GeoLocationHelper.toStoredCountryCode(code))
        .filter((code): code is string => Boolean(code)),
    ),
  );

  if (normalized.length > 0) {
    if (!normalized.includes(fallback)) {
      normalized.unshift(fallback);
    }
    return normalized;
  }

  if (
    options?.allowEmpty &&
    countries !== undefined &&
    countries !== null &&
    countries.length === 0
  ) {
    return [];
  }

  return [fallback];
}

export function isNigeriaWorkspace(tenantCountryCode?: string | null): boolean {
  return (GeoLocationHelper.toStoredCountryCode(tenantCountryCode ?? '') ?? '') === 'NG';
}
