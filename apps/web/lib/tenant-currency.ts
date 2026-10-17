import { SUPPORTED_FIAT_CURRENCIES } from '@/lib/constants/currencies';

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
const SUPPORTED_FIAT = new Set<string>(SUPPORTED_FIAT_CURRENCIES);

/** Fiat currency a country pays in. Falls back to USD. */
export function getDefaultCurrencyForCountry(countryCode?: string | null): string {
  const code = countryCode?.trim().toUpperCase();
  if (!code) return 'USD';
  if (code === 'NG') return 'NGN';
  if (GBP_COUNTRY_CODES.has(code)) return 'GBP';
  if (EURO_COUNTRY_CODES.has(code)) return 'EUR';
  return 'USD';
}

export interface TenantCurrencyInput {
  countryCode?: string | null;
  preferredCurrency?: string | null;
}

/**
 * The single authoritative workspace currency on the client. Mirrors
 * `apps/api/src/common/utils/tenant-currency.util.ts`.
 *
 * Precedence: NG lock → explicit supported `preferredCurrency` → country default.
 * `settings.general.currency` is intentionally not consulted.
 */
export function resolveTenantDefaultCurrency({
  countryCode,
  preferredCurrency,
}: TenantCurrencyInput): string {
  if (countryCode?.trim().toUpperCase() === 'NG') {
    return 'NGN';
  }

  const preferred = preferredCurrency?.trim().toUpperCase();
  if (preferred && SUPPORTED_FIAT.has(preferred)) {
    return preferred;
  }

  return getDefaultCurrencyForCountry(countryCode);
}

/**
 * Primary currency a workspace pays salaries in: the first enabled payroll
 * currency (`settings.general.payrollCurrencies`), else the region seed.
 * Mirrors the API's `getPayrollCurrencies(tenantId)[0]`.
 */
export function resolvePrimaryPayrollCurrency(input: {
  enabledPayrollCurrencies?: readonly string[] | null;
  countryCode?: string | null;
  preferredCurrency?: string | null;
}): string {
  const enabled = (input.enabledPayrollCurrencies ?? [])
    .map((code) => code.toUpperCase())
    .filter((code) => SUPPORTED_FIAT.has(code));
  if (enabled.length > 0) {
    return enabled[0];
  }
  return resolveTenantDefaultCurrency({
    countryCode: input.countryCode,
    preferredCurrency: input.preferredCurrency,
  });
}
