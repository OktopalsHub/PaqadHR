import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { getMonnifyWebhookSecret } from './monnify.config';

export function verifyMonnifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = getMonnifyWebhookSecret();
  const normalizedSignature = signature.trim().toLowerCase();
  if (!secret || !normalizedSignature) {
    return false;
  }

  try {
    const hmacDigest = createHmac('sha512', secret).update(rawBody).digest('hex');
    if (signaturesMatch(hmacDigest, normalizedSignature)) {
      return true;
    }
  } catch {}

  try {
    const concatDigest = createHash('sha512').update(`${secret}${rawBody}`).digest('hex');
    if (signaturesMatch(concatDigest, normalizedSignature)) {
      return true;
    }
  } catch {}

  return false;
}

function signaturesMatch(expected: string, received: string): boolean {
  try {
    const a = Buffer.from(expected.toLowerCase(), 'utf8');
    const b = Buffer.from(received.toLowerCase(), 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
