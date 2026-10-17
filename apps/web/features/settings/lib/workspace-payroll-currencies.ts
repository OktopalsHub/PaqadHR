import { SUPPORTED_FIAT_CURRENCIES } from '@/lib/constants/currencies';
import { getDefaultCurrencyForCountry, resolveTenantDefaultCurrency } from '@/lib/tenant-currency';

export { getDefaultCurrencyForCountry as getDefaultPayrollCurrencyForCountry };

export function withDefaultCurrencyFirst(
  currencies: readonly string[],
  defaultCurrency: string,
): string[] {
  const allowed = new Set<string>(SUPPORTED_FIAT_CURRENCIES);
  const normalized = currencies
    .map((code) => code.toUpperCase())
    .filter((code) => allowed.has(code));

  const unique = Array.from(new Set(normalized.filter((code) => code !== defaultCurrency)));
  return [defaultCurrency, ...unique];
}

interface ResolveInitialPayrollCurrenciesInput {
  countryCode?: string | null;
  settingsPayrollCurrencies?: readonly string[] | null;
  tenantPreferredCurrency?: string | null;
}

export function resolveInitialPayrollCurrencies({
  countryCode,
  settingsPayrollCurrencies,
  tenantPreferredCurrency,
}: ResolveInitialPayrollCurrenciesInput): string[] {
  const defaultCurrency = getDefaultCurrencyForCountry(countryCode);
  const allowed = new Set<string>(SUPPORTED_FIAT_CURRENCIES);
  const fromSettings = settingsPayrollCurrencies
    ?.map((code) => code.toUpperCase())
    .filter((code) => allowed.has(code));

  if (fromSettings && fromSettings.length > 0) {
    // Preserve saved primary (first chip). Do not force country default ahead of it —
    // that rewrote preferredCurrency on every Save and tripped the rewards-wallet lock
    // when toggling unrelated flags like cryptoEnabled.
    const unique = Array.from(new Set(fromSettings));
    const preferred = tenantPreferredCurrency?.trim().toUpperCase();
    if (preferred && unique.includes(preferred)) {
      return [preferred, ...unique.filter((code) => code !== preferred)];
    }
    return unique;
  }

  // Region-derived currency is authoritative; settings.general.currency is a legacy
  // field seeded to USD and must not shadow it.
  const primary = resolveTenantDefaultCurrency({
    countryCode,
    preferredCurrency: tenantPreferredCurrency,
  });
  return withDefaultCurrencyFirst([primary], defaultCurrency);
}

export function reprioritizePayrollCurrenciesForCountry(
  currencies: readonly string[],
  countryCode?: string | null,
): string[] {
  return withDefaultCurrencyFirst(currencies, getDefaultCurrencyForCountry(countryCode));
}
