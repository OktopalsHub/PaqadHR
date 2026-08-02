import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { getMonnifyWebhookSecret } from './monnify.config';

export function verifyMonnifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = getMonnifyWebhookSecret();
  if (!secret || !signature) {
    return false;
  }

  try {
    const hmacDigest = createHmac('sha512', secret).update(rawBody).digest('hex');
    if (signaturesMatch(hmacDigest, signature)) {
      return true;
    }
  } catch {}

  try {
    const concatDigest = createHash('sha512').update(`${secret}${rawBody}`).digest('hex');
    if (signaturesMatch(concatDigest, signature)) {
      return true;
    }
  } catch {}

  return false;
}

function signaturesMatch(expected: string, received: string): boolean {
  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(received, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
