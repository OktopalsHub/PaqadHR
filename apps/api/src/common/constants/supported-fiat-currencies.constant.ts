export const SUPPORTED_FIAT_CURRENCIES = ['NGN', 'USD', 'EUR', 'GBP'] as const;

export type SupportedFiatCurrency = (typeof SUPPORTED_FIAT_CURRENCIES)[number];

export function isSupportedFiatCurrency(value: string): value is SupportedFiatCurrency {
  return SUPPORTED_FIAT_CURRENCIES.includes(value.toUpperCase() as SupportedFiatCurrency);
}

export function normalizeFiatCurrencies(currencies: string[]): SupportedFiatCurrency[] {
  const seen = new Set<SupportedFiatCurrency>();
  for (const code of currencies) {
    const upper = code.toUpperCase();
    if (isSupportedFiatCurrency(upper)) {
      seen.add(upper);
    }
  }
  return [...seen];
}

/** ponytail: unsupported Reloadly recipient fiat bills via USD pivot */
export function billingPivotCurrency(local: string): SupportedFiatCurrency | 'USD' {
  const upper = local.toUpperCase();
  return isSupportedFiatCurrency(upper) ? upper : 'USD';
}
