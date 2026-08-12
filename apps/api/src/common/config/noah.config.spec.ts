import { generateKeyPairSync } from 'node:crypto';
import {
  getNoahSigningPrivateKey,
  getNoahSigningPrivateKeyValidationWarning,
  isNoahSigningPrivateKeyValid,
  normalizeNoahSigningPrivateKeyPem,
} from './noah.config';

describe('getNoahSigningPrivateKey', () => {
  const original = process.env.NOAH_SIGNING_PRIVATE_KEY;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NOAH_SIGNING_PRIVATE_KEY;
    } else {
      process.env.NOAH_SIGNING_PRIVATE_KEY = original;
    }
  });

  it('expands literal \\n for single-line PEM env values', () => {
    process.env.NOAH_SIGNING_PRIVATE_KEY =
      '-----BEGIN EC PRIVATE KEY-----\\nABC\\n-----END EC PRIVATE KEY-----';
    expect(getNoahSigningPrivateKey()).toBe(
      '-----BEGIN EC PRIVATE KEY-----\nABC\n-----END EC PRIVATE KEY-----',
    );
  });

  it('strips surrounding quotes', () => {
    process.env.NOAH_SIGNING_PRIVATE_KEY =
      '"-----BEGIN EC PRIVATE KEY-----\\nABC\\n-----END EC PRIVATE KEY-----"';
    expect(getNoahSigningPrivateKey()).toBe(
      '-----BEGIN EC PRIVATE KEY-----\nABC\n-----END EC PRIVATE KEY-----',
    );
  });

  it('normalizes collapsed PEM on one line', () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const collapsed = pem.replace(/\n/g, ' ');
    expect(normalizeNoahSigningPrivateKeyPem(collapsed)).toBe(pem.trim());
    expect(isNoahSigningPrivateKeyValid(normalizeNoahSigningPrivateKeyPem(collapsed))).toBe(true);
  });

  it('returns validation warning for invalid key material', () => {
    process.env.NOAH_SIGNING_PRIVATE_KEY = 'not-a-pem-key';
    expect(getNoahSigningPrivateKeyValidationWarning()).toContain('NOAH_SIGNING_PRIVATE_KEY');
  });

  it('returns null validation warning for valid PKCS8 key', () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    process.env.NOAH_SIGNING_PRIVATE_KEY = pem.replace(/\n/g, '\\n');
    expect(getNoahSigningPrivateKeyValidationWarning()).toBeNull();
  });
});
