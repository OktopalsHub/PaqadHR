import { isSupportedFiatCurrency } from '../constants/supported-fiat-currencies.constant';
import { GeoLocationHelper, getDefaultFiatCurrencyForCountry } from './geo-location.util';

export interface TenantCurrencyInput {
  countryCode?: string | null;
  preferredCurrency?: string | null;
}

/**
 * The single authoritative workspace currency.
 *
 * Precedence:
 *   1. Nigeria is locked to NGN — matches subscription plan pricing.
 *   2. An explicit, supported `preferredCurrency`.
 *   3. The country's default fiat currency (USD / EUR / GBP).
 *
 * `settings.general.currency` is deliberately NOT consulted: it is seeded to
 * 'USD' for every workspace and previously shadowed the region-derived currency,
 * so an NG workspace could report NGN for billing but USD for payroll.
 */
export function resolveTenantDefaultCurrency({
  countryCode,
  preferredCurrency,
}: TenantCurrencyInput): string {
  if (GeoLocationHelper.toStoredCountryCode(countryCode) === 'NG') {
    return 'NGN';
  }

  const preferred = preferredCurrency?.trim().toUpperCase();
  if (preferred && isSupportedFiatCurrency(preferred)) {
    return preferred;
  }

  return getDefaultFiatCurrencyForCountry(countryCode);
}
