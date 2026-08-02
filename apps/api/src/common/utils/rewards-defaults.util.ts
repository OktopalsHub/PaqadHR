import { GeoLocationHelper } from './geo-location.util';

export function resolveDefaultRewardsCurrency(
  tenantCountryCode?: string | null,
  tenantPreferredCurrency?: string | null,
): string {
  const preferred = tenantPreferredCurrency?.trim().toUpperCase();
  if (preferred) {
    return preferred;
  }

  const defaults = GeoLocationHelper.getCountryDefaults(tenantCountryCode ?? '');
  return defaults.currency.toUpperCase();
}

export function resolveDefaultRewardsCatalogCountry(options: {
  tenantCountryCode?: string | null;
  creatorCountryCode?: string | null;
}): string {
  return (
    GeoLocationHelper.toStoredCountryCode(options.creatorCountryCode) ?? 'US'
  );
}

export function normalizeRewardsCatalogCountries(
  countries: readonly string[] | null | undefined,
  fallbackCountry: string,
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

  return [fallbackCountry];
}
