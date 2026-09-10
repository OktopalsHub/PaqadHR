import {
  CRYPTO_NETWORKS_BY_CURRENCY,
  isCryptoCurrency,
  isCryptoNetworkAllowed,
  normalizeCryptoNetwork,
} from './crypto-currencies.constant';

describe('crypto-currencies.constant', () => {
  it('recognizes supported crypto currencies', () => {
    expect(isCryptoCurrency('btc')).toBe(true);
    expect(isCryptoCurrency('USDC')).toBe(true);
    expect(isCryptoCurrency('NGN')).toBe(false);
  });

  it('normalizes allowed networks case-insensitively', () => {
    expect(normalizeCryptoNetwork('BTC', 'bitcoin')).toBe('Bitcoin');
    expect(normalizeCryptoNetwork('ETH', 'Ethereum')).toBe('Ethereum');
    expect(normalizeCryptoNetwork('USDC', 'base')).toBe('Base');
    expect(normalizeCryptoNetwork('USDT', 'ETHEREUM')).toBe('Ethereum');
  });

  it('rejects currency-incompatible or unknown networks', () => {
    expect(isCryptoNetworkAllowed('BTC', 'Ethereum')).toBe(false);
    expect(isCryptoNetworkAllowed('USDT', 'Tron')).toBe(false);
    expect(isCryptoNetworkAllowed('ETH', 'solana')).toBe(false);
    expect(isCryptoNetworkAllowed('ETH', '')).toBe(false);
    expect(isCryptoNetworkAllowed('NGN', 'Ethereum')).toBe(false);
  });

  it('lists at least Ethereum for USDT and USDC', () => {
    expect(CRYPTO_NETWORKS_BY_CURRENCY.USDT).toContain('Ethereum');
    expect(CRYPTO_NETWORKS_BY_CURRENCY.USDC).toContain('Ethereum');
  });
});
