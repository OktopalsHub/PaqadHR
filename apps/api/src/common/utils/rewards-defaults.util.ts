import { GeoLocationHelper } from './geo-location.util';

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
  return 'USD';
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
