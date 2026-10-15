import {
  CRYPTO_NETWORKS_BY_CURRENCY,
  isCryptoCurrency,
  isCryptoNetworkAllowed,
  normalizeCryptoNetwork,
} from './crypto-currencies.constant';

describe('crypto-currencies.constant', () => {
  it('recognizes only the supported stablecoins', () => {
    expect(isCryptoCurrency('usdt')).toBe(true);
    expect(isCryptoCurrency('USDC')).toBe(true);
    expect(isCryptoCurrency('NGN')).toBe(false);
  });

  it('does not treat native assets as payable crypto', () => {
    // Bachs is the only crypto rail and delivers stablecoins only, so a native asset
    // must never be routable — otherwise it builds a payout that can only fail at the provider.
    expect(isCryptoCurrency('BTC')).toBe(false);
    expect(isCryptoCurrency('ETH')).toBe(false);
    expect(isCryptoCurrency('SOL')).toBe(false);
  });

  it('normalizes allowed networks case-insensitively', () => {
    expect(normalizeCryptoNetwork('USDC', 'solana')).toBe('Solana');
    expect(normalizeCryptoNetwork('USDC', 'base')).toBe('Base');
    expect(normalizeCryptoNetwork('USDT', 'ETHEREUM')).toBe('Ethereum');
  });

  it('rejects currency-incompatible or unknown networks', () => {
    expect(isCryptoNetworkAllowed('USDT', 'Tron')).toBe(false);
    expect(isCryptoNetworkAllowed('USDC', '')).toBe(false);
    expect(isCryptoNetworkAllowed('USDT', 'Solana')).toBe(false);
    expect(isCryptoNetworkAllowed('NGN', 'Ethereum')).toBe(false);
    expect(isCryptoNetworkAllowed('SOL', 'Solana')).toBe(false);
  });

  it('lists at least Ethereum for USDT and USDC', () => {
    expect(CRYPTO_NETWORKS_BY_CURRENCY.USDT).toContain('Ethereum');
    expect(CRYPTO_NETWORKS_BY_CURRENCY.USDC).toContain('Ethereum');
  });

  it('exposes no network map entries for unsupported native assets', () => {
    expect(CRYPTO_NETWORKS_BY_CURRENCY).not.toHaveProperty('BTC');
    expect(CRYPTO_NETWORKS_BY_CURRENCY).not.toHaveProperty('ETH');
    expect(CRYPTO_NETWORKS_BY_CURRENCY).not.toHaveProperty('SOL');
  });
});
