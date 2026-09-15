import { assertAndCanonicalizeCryptoNetwork } from './pm-validation';

describe('assertAndCanonicalizeCryptoNetwork', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.BACHS_SECRET_KEY;
    delete process.env.INTL_PAYROLL_PROVIDER;
  });

  afterAll(() => {
    process.env = env;
  });

  it('canonicalizes Noah network names', () => {
    expect(assertAndCanonicalizeCryptoNetwork('USDT', 'ethereum')).toBe('Ethereum');
    expect(assertAndCanonicalizeCryptoNetwork('USDC', 'base')).toBe('Base');
    expect(assertAndCanonicalizeCryptoNetwork('BTC', 'bitcoin')).toBe('Bitcoin');
  });

  it('requires a network', () => {
    expect(() => assertAndCanonicalizeCryptoNetwork('USDT', '')).toThrow(/requires a network/i);
    expect(() => assertAndCanonicalizeCryptoNetwork('USDT', undefined)).toThrow(
      /requires a network/i,
    );
  });

  it('rejects Bachs USDT networks when the Bachs payout rail is not enabled', () => {
    expect(() => assertAndCanonicalizeCryptoNetwork('USDT', 'TRC20')).toThrow(
      /requires the Bachs payout rail/i,
    );
  });

  it('accepts Bachs USDT networks once BACHS_SECRET_KEY and INTL_PAYROLL_PROVIDER=bachs are set', () => {
    process.env.BACHS_SECRET_KEY = 'sk_sandbox_test';
    process.env.INTL_PAYROLL_PROVIDER = 'bachs';

    expect(assertAndCanonicalizeCryptoNetwork('USDT', 'trc20')).toBe('TRC20');
    expect(assertAndCanonicalizeCryptoNetwork('USDT', 'BEP20')).toBe('BEP20');
  });

  it('does not accept Bachs USDT networks for other currencies', () => {
    process.env.BACHS_SECRET_KEY = 'sk_sandbox_test';
    process.env.INTL_PAYROLL_PROVIDER = 'bachs';

    expect(() => assertAndCanonicalizeCryptoNetwork('USDC', 'TRC20')).toThrow(
      /Unsupported network for USDC/i,
    );
  });

  it('rejects unknown networks', () => {
    process.env.BACHS_SECRET_KEY = 'sk_sandbox_test';
    process.env.INTL_PAYROLL_PROVIDER = 'bachs';

    expect(() => assertAndCanonicalizeCryptoNetwork('USDT', 'Dogechain')).toThrow(
      /Unsupported network for USDT/i,
    );
  });
});
