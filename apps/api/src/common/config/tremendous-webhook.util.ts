import { createHmac } from 'node:crypto';
import { signaturesMatch } from './webhook-signature.util';

export function getTremendousWebhookSecret(): string {
  return (process.env.TREMENDOUS_WEBHOOK_SECRET || '').trim();
}

/**
 * Verify a Tremendous webhook signature.
 *
 * Tremendous signs the raw request body with HMAC-SHA256 using the webhook
 * secret configured in the Tremendous dashboard, and sends the hex digest in
 * the `Tremendous-Webhook-Signature` header.
 *
 * Fail-closed: any missing secret/signature or comparison failure returns
 * false — the caller must reject the request before any side effects.
 */
export function verifyTremendousWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = getTremendousWebhookSecret();
  if (!secret || !signature?.trim()) {
    return false;
  }
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  return signaturesMatch(expected, signature.trim().toLowerCase());
}

/**
 * Delivery/claim links in webhook payloads are rendered into employee emails,
 * so only allow https URLs on Tremendous-controlled hosts.
 */
export function isAllowedTremendousUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return host === 'tremendous.com' || host.endsWith('.tremendous.com');
  } catch {
    return false;
  }
}
