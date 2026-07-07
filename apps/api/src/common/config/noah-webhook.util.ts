import { createHmac, timingSafeEqual } from 'node:crypto';
import { getNoahWebhookSecret } from './noah.config';

export function verifyNoahWebhookSignature(
  rawBody: string,
  signature: string,
  timestamp?: string,
): boolean {
  const secret = getNoahWebhookSecret();
  if (!secret || !signature?.trim()) {
    return false;
  }

  const payload = timestamp ? `${timestamp}.${rawBody}` : rawBody;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  const provided = signature.replace(/^sha256=/i, '').trim();

  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(provided, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
