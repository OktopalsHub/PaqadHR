import { createPrivateKey } from 'node:crypto';

export type NoahEnvironment = 'sandbox' | 'production';

/** Noah webhook verification public keys (https://docs.noah.com/api-concepts/webhooks/configuration/) */
const NOAH_WEBHOOK_PUBLIC_KEYS: Record<NoahEnvironment, string> = {
  sandbox: `-----BEGIN PUBLIC KEY-----
MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAEm8yBiD+kmVJ1Xc9sfRkDx0yo9+u8yiAD
PngI20KoEswz0gflp8o/z66Abqz/m9A1CBecixWdeT72pA8NZBJI6L6Osd8RV+yx
QArxeGKEVX/2QNrfPqeAKODHT5LdStGT
-----END PUBLIC KEY-----`,
  production: `-----BEGIN PUBLIC KEY-----
MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAELKJhxcUGJr3XgRrf+laSAVHvp31wFhE2
XdicXvF0DAdKzSPN8bkSdjrsUA6nnVUq3M47Y7RUYugMfkagaYjUExQZVjpMFg0
PDnXWl9y0dXYDq+pzYhAgL+MNpnY0eJ78
-----END PUBLIC KEY-----`,
};

export function getNoahEnvironment(): NoahEnvironment {
  const env = (process.env.NOAH_ENVIRONMENT || 'sandbox').toLowerCase();
  return env === 'production' ? 'production' : 'sandbox';
}

export function getNoahApiKey(): string {
  return (process.env.NOAH_API_KEY || '').trim();
}

/** Normalize PEM from Dokploy/Docker single-line env values. */
export function normalizeNoahSigningPrivateKeyPem(raw: string): string {
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  if (key.includes('\\n')) {
    key = key.replace(/\\n/g, '\n');
  }
  if (key.includes('BEGIN') && !key.includes('\n')) {
    const match = key.match(/^-----BEGIN ([A-Z0-9 ]+)-----\s*(.+?)\s*-----END \1-----$/is);
    if (match) {
      const label = match[1];
      const body = match[2].replace(/\s+/g, '');
      const wrapped = body.match(/.{1,64}/g)?.join('\n') ?? body;
      key = `-----BEGIN ${label}-----\n${wrapped}\n-----END ${label}-----`;
    } else {
      key = key
        .replace(/-----BEGIN ([A-Z0-9 ]+)-----\s*/i, '-----BEGIN $1-----\n')
        .replace(/\s*-----END ([A-Z0-9 ]+)-----$/i, '\n-----END $1-----');
    }
  }
  return key.trim();
}

export function isNoahSigningPrivateKeyValid(pem: string): boolean {
  if (!pem.trim()) return false;
  try {
    createPrivateKey(pem);
    return true;
  } catch {
    return false;
  }
}

export function getNoahSigningPrivateKey(): string {
  const raw = (process.env.NOAH_SIGNING_PRIVATE_KEY || '').trim();
  if (!raw) return '';
  return normalizeNoahSigningPrivateKeyPem(raw);
}

/** Boot-time warning when a signing key is set but not parseable. */
export function getNoahSigningPrivateKeyValidationWarning(): string | null {
  const raw = (process.env.NOAH_SIGNING_PRIVATE_KEY || '').trim();
  if (!raw) return null;
  const normalized = normalizeNoahSigningPrivateKeyPem(raw);
  if (isNoahSigningPrivateKeyValid(normalized)) return null;
  return 'NOAH_SIGNING_PRIVATE_KEY is set but is not a valid EC private key PEM — Noah checkout signing will fail';
}

export function getNoahWebhookPublicKey(): string {
  const override = process.env.NOAH_WEBHOOK_PUBLIC_KEY?.trim();
  if (override) return override;
  return NOAH_WEBHOOK_PUBLIC_KEYS[getNoahEnvironment()];
}

export function getNoahBaseUrl(): string {
  const override = process.env.NOAH_API_BASE_URL?.trim();
  if (override) {
    return override.replace(/\/$/, '');
  }
  return getNoahEnvironment() === 'production'
    ? 'https://api.noah.com/v1'
    : 'https://api.sandbox.noah.com/v1';
}

/** Default stablecoin used as Noah payout source for fiat payroll. */
export function getNoahPayoutCryptoCurrency(): string {
  return (process.env.NOAH_PAYOUT_CRYPTO_CURRENCY || 'USDC').toUpperCase();
}

export function isNoahConfigured(): boolean {
  return !!getNoahApiKey();
}

export function isNoahSigningRequired(): boolean {
  return getNoahEnvironment() === 'production' || !!getNoahSigningPrivateKey();
}
