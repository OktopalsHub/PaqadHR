import { createHash, verify } from 'node:crypto';

import { getBridgeWebhookPublicKey } from './bridge.config';

const MAX_WEBHOOK_AGE_MS = 10 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 60 * 1000;

export function verifyBridgeWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  now = Date.now(),
): boolean {
  const publicKey = getBridgeWebhookPublicKey();
  if (!publicKey || !signatureHeader || rawBody.length === 0) return false;
  const match = /^t=(\d{13}),v0=([A-Za-z0-9+/]+={0,2})$/.exec(signatureHeader.trim());
  if (!match) return false;
  const timestamp = Number(match[1]);
  if (
    !Number.isSafeInteger(timestamp) ||
    timestamp < now - MAX_WEBHOOK_AGE_MS ||
    timestamp > now + MAX_FUTURE_SKEW_MS
  ) {
    return false;
  }
  const signature = Buffer.from(match[2], 'base64');
  if (!signature.length || signature.toString('base64') !== match[2]) return false;
  const messageDigest = createHash('sha256')
    .update(`${match[1]}.${rawBody.toString('utf8')}`)
    .digest();
  try {
    return verify('RSA-SHA256', messageDigest, publicKey, signature);
  } catch {
    return false;
  }
}
