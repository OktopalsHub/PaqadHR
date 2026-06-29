export const SUPPORTED_FIAT_CURRENCIES = ['USD', 'EUR', 'GBP', 'NGN', 'KES', 'GHS', 'ZAR'] as const;

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
