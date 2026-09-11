/** Crypto currencies for intl payroll (Noah; Fincra where schemes exist). */
export const SUPPORTED_CRYPTO_CURRENCIES = ['USDT', 'USDC', 'BTC', 'ETH', 'SOL'] as const;

export type SupportedCryptoCurrency = (typeof SUPPORTED_CRYPTO_CURRENCIES)[number];

/** Noah production network names allowed per currency (case-insensitive match). */
export const CRYPTO_NETWORKS_BY_CURRENCY: Record<SupportedCryptoCurrency, readonly string[]> = {
  USDC: ['Ethereum', 'Base', 'PolygonPos', 'Solana', 'Celo', 'Gnosis', 'FlowEvm'],
  USDT: ['Ethereum'],
  BTC: ['Bitcoin'],
  ETH: ['Ethereum'],
  SOL: ['Solana'],
};

/** Map common UI aliases → canonical network names. */
const NETWORK_ALIASES: Record<string, string> = {
  bitcoin: 'Bitcoin',
  btc: 'Bitcoin',
  ethereum: 'Ethereum',
  eth: 'Ethereum',
  erc20: 'Ethereum',
  base: 'Base',
  polygon: 'PolygonPos',
  polygonpos: 'PolygonPos',
  matic: 'PolygonPos',
  solana: 'Solana',
  sol: 'Solana',
  celo: 'Celo',
  gnosis: 'Gnosis',
  flowevm: 'FlowEvm',
  flow: 'FlowEvm',
};

export function isCryptoCurrency(value: string): boolean {
  return SUPPORTED_CRYPTO_CURRENCIES.includes(value.toUpperCase() as SupportedCryptoCurrency);
}

/** Native L1 assets that Noah withdraws (prefer Noah over Fincra). */
export function isNoahNativeCryptoCurrency(value: string): boolean {
  const code = value.toUpperCase();
  return code === 'BTC' || code === 'ETH' || code === 'SOL';
}

/** Returns the canonical network name, or null when currency/network pairing is invalid. */
export function normalizeCryptoNetwork(currency: string, network: string): string | null {
  const normalizedCurrency = currency.toUpperCase() as SupportedCryptoCurrency;
  const allowed = CRYPTO_NETWORKS_BY_CURRENCY[normalizedCurrency];
  if (!allowed) return null;
  const needle = network
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  if (!needle) return null;

  const aliased = NETWORK_ALIASES[needle];
  if (aliased && allowed.some((entry) => entry.toLowerCase() === aliased.toLowerCase())) {
    return aliased;
  }

  return allowed.find((entry) => entry.toLowerCase().replace(/[\s_-]+/g, '') === needle) ?? null;
}

export function isCryptoNetworkAllowed(currency: string, network: string): boolean {
  return normalizeCryptoNetwork(currency, network) !== null;
}
