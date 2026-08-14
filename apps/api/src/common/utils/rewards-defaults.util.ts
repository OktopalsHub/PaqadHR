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

export type GiftCardProvider = 'reloadly' | 'tremendous';

export const DEFAULT_GIFT_CARD_PROVIDER: GiftCardProvider = 'tremendous';

export function isNigeriaWorkspace(tenantCountryCode?: string | null): boolean {
  return (GeoLocationHelper.toStoredCountryCode(tenantCountryCode ?? '') ?? '') === 'NG';
}

export function resolveGiftCardProvider(value?: string | null): GiftCardProvider {
  return value === 'reloadly' ? 'reloadly' : DEFAULT_GIFT_CARD_PROVIDER;
}

/**
 * Gift catalogs follow the funded provider account, not tenant country.
 * Nigeria workspaces get every configured platform; everyone else gets the selected one.
 */
export function resolveGiftCatalogProviders(
  tenantCountryCode?: string | null,
  selected?: string | null,
): GiftCardProvider[] {
  if (isNigeriaWorkspace(tenantCountryCode)) {
    return ['tremendous', 'reloadly'];
  }
  return [resolveGiftCardProvider(selected)];
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

/** @deprecated Catalogs are provider-native; do not infer tenant country. */
export function resolveRewardsCatalogCountries(_tenantCountryCode?: string | null): string[] {
  return [];
}

export function normalizeRewardsCatalogCountries(
  countries: readonly string[] | null | undefined,
  fallbackCountry: string,
  options?: { allowEmpty?: boolean },
): string[] {
  const normalized = Array.from(
    new Set(
      (countries ?? [])
        .map((code) => GeoLocationHelper.toStoredCountryCode(code))
        .filter((code): code is string => Boolean(code)),
    ),
  );

  if (normalized.length > 0) {
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

  return [fallbackCountry];
}
