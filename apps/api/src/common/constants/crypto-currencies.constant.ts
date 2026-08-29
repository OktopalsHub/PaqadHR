/** Stablecoins routed through Noah or Fincra. */
export const SUPPORTED_CRYPTO_CURRENCIES = ['USDT', 'USDC'] as const;

export type SupportedCryptoCurrency = (typeof SUPPORTED_CRYPTO_CURRENCIES)[number];

export function isCryptoCurrency(value: string): boolean {
  return SUPPORTED_CRYPTO_CURRENCIES.includes(value.toUpperCase() as SupportedCryptoCurrency);
}
