const EURO_COUNTRY_CODES = new Set([
  'AD',
  'AT',
  'BE',
  'BG',
  'CY',
  'DE',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HR',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MC',
  'ME',
  'MT',
  'NL',
  'PT',
  'SI',
  'SK',
  'SM',
  'VA',
  'XK',
]);

const GBP_COUNTRY_CODES = new Set(['GB', 'GG', 'IM', 'JE']);
const SUPPORTED_FIAT_CURRENCIES = ['NGN', 'USD', 'EUR', 'GBP'] as const;

export function getDefaultPayrollCurrencyForCountry(countryCode?: string | null): string {
  const code = countryCode?.trim().toUpperCase();
  if (!code) return 'USD';
  if (code === 'NG') return 'NGN';
  if (GBP_COUNTRY_CODES.has(code)) return 'GBP';
  if (EURO_COUNTRY_CODES.has(code)) return 'EUR';
  return 'USD';
}

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
  settingsCurrency?: string | null;
  tenantPreferredCurrency?: string | null;
}

export function resolveInitialPayrollCurrencies({
  countryCode,
  settingsPayrollCurrencies,
  settingsCurrency,
  tenantPreferredCurrency,
}: ResolveInitialPayrollCurrenciesInput): string[] {
  const defaultCurrency = getDefaultPayrollCurrencyForCountry(countryCode);
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

  const primary = (settingsCurrency ?? tenantPreferredCurrency ?? defaultCurrency).toUpperCase();
  return withDefaultCurrencyFirst([primary], defaultCurrency);
}

export function reprioritizePayrollCurrenciesForCountry(
  currencies: readonly string[],
  countryCode?: string | null,
): string[] {
  return withDefaultCurrencyFirst(currencies, getDefaultPayrollCurrencyForCountry(countryCode));
}
