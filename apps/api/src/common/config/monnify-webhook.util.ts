import { createHash, createHmac } from 'node:crypto';
import { getMonnifyWebhookSecret } from './monnify.config';
import { signaturesMatch } from './webhook-signature.util';

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
