import { createHash, generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { createNoahApiSignature, noahJwtPath } from './noah-request-sign.util';

describe('noah-request-sign.util', () => {
  let privateKeyPem: string;

  beforeAll(() => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
    privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  });

  it('noahJwtPath prefixes /v1 when base URL includes it', () => {
    expect(noahJwtPath('/transactions', 'https://api.sandbox.noah.com/v1')).toBe(
      '/v1/transactions',
    );
  });

  it('createNoahApiSignature includes stable bodyHash for identical body bytes', () => {
    const body = Buffer.from(JSON.stringify({ amount: '100' }));
    const expectedHash = createHash('sha256').update(body).digest('hex');

    const token = createNoahApiSignature({
      method: 'POST',
      path: '/v1/checkout/payin/fiat',
      privateKey: privateKeyPem,
      body,
    });

    const decoded = jwt.decode(token) as Record<string, unknown>;
    expect(decoded.method).toBe('POST');
    expect(decoded.path).toBe('/v1/checkout/payin/fiat');
    expect(decoded.aud).toBe('https://api.noah.com');
    expect(decoded.bodyHash).toBe(expectedHash);
  });

  it('createNoahApiSignature includes queryParams when provided', () => {
    const token = createNoahApiSignature({
      method: 'GET',
      path: '/v1/channels/sell',
      privateKey: privateKeyPem,
      queryParams: { country: 'US', fiatCurrency: 'USD' },
    });

    const decoded = jwt.decode(token) as Record<string, unknown>;
    expect(decoded.queryParams).toEqual({ country: 'US', fiatCurrency: 'USD' });
    expect(decoded.bodyHash).toBeUndefined();
  });
});
