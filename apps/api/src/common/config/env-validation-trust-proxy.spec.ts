import { collectConfigErrors } from './env-validation-rules';

describe('TRUST_PROXY validation', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  const proxyErrors = () => collectConfigErrors().filter((e) => e.includes('TRUST_PROXY'));

  it('is required in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.TRUST_PROXY;
    expect(proxyErrors()).toHaveLength(1);
    process.env.TRUST_PROXY = '0';
    expect(proxyErrors()).toHaveLength(1);
    process.env.TRUST_PROXY = 'true';
    expect(proxyErrors()).toHaveLength(1);
  });

  it('accepts a positive hop count and is not enforced outside production', () => {
    process.env.NODE_ENV = 'production';
    process.env.TRUST_PROXY = '1';
    expect(proxyErrors()).toEqual([]);
    process.env.NODE_ENV = 'development';
    delete process.env.TRUST_PROXY;
    expect(proxyErrors()).toEqual([]);
  });
});
