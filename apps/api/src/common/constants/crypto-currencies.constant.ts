/** Stablecoins routed through Noah or Fincra. */
export const SUPPORTED_CRYPTO_CURRENCIES = ['USDT', 'USDC'] as const;

export type SupportedCryptoCurrency = (typeof SUPPORTED_CRYPTO_CURRENCIES)[number];

/** Noah production network names allowed per currency (case-insensitive match). */
export const CRYPTO_NETWORKS_BY_CURRENCY: Record<SupportedCryptoCurrency, readonly string[]> = {
  BTC: ['Bitcoin'],
  ETH: ['Ethereum'],
  USDC: ['Ethereum', 'Base', 'PolygonPos', 'Solana', 'Celo', 'Gnosis', 'FlowEvm'],
  USDT: ['Ethereum'],
};

export function isCryptoCurrency(value: string): boolean {
  return SUPPORTED_CRYPTO_CURRENCIES.includes(value.toUpperCase() as SupportedCryptoCurrency);
}

/** Returns the canonical network name, or null when currency/network pairing is invalid. */
export function normalizeCryptoNetwork(currency: string, network: string): string | null {
  const normalizedCurrency = currency.toUpperCase() as SupportedCryptoCurrency;
  const allowed = CRYPTO_NETWORKS_BY_CURRENCY[normalizedCurrency];
  if (!allowed) return null;
  const needle = network.trim().toLowerCase();
  if (!needle) return null;
  return allowed.find((entry) => entry.toLowerCase() === needle) ?? null;
}

export function isCryptoNetworkAllowed(currency: string, network: string): boolean {
  return normalizeCryptoNetwork(currency, network) !== null;
}
