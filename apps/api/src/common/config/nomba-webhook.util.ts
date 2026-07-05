import { createHmac, timingSafeEqual } from 'node:crypto';
import { getNombaWebhookSecret } from './nomba.config';

export function verifyNombaWebhookSignature(
  rawBody: string,
  signature: string,
  timestamp?: string,
): boolean {
  const secret = getNombaWebhookSecret();
  if (!secret || !signature) {
    return false;
  }

  try {
    const payload = JSON.parse(rawBody) as {
      event_type?: string;
      eventType?: string;
      requestId?: string;
      data?: {
        merchant?: { userId?: string; walletId?: string };
        transaction?: {
          transactionId?: string;
          type?: string;
          time?: string;
          responseCode?: string;
        };
      };
    };

    const eventType = payload.event_type || payload.eventType || '';
    const requestId = payload.requestId || '';
    const merchant = payload.data?.merchant;
    const transaction = payload.data?.transaction;
    const userId = merchant?.userId || '';
    const walletId = merchant?.walletId || '';
    const transactionId = transaction?.transactionId || '';
    const transactionType = transaction?.type || '';
    const transactionTime = transaction?.time || '';
    let responseCode = transaction?.responseCode ?? '';
    if (responseCode === 'null') responseCode = '';

    // Last field must be nomba-timestamp header (not transaction.time again).
    const timeStamp = timestamp || transactionTime;
    const hashingPayload = `${eventType}:${requestId}:${userId}:${walletId}:${transactionId}:${transactionType}:${transactionTime}:${responseCode}:${timeStamp}`;
    const hash = createHmac('sha256', secret).update(hashingPayload).digest('base64');

    if (signaturesMatch(hash, signature)) {
      return true;
    }
  } catch {}

  // Fallback: some integrations sign the raw body (hex).
  try {
    const hash = createHmac('sha256', secret).update(rawBody).digest('hex');
    if (signaturesMatch(hash, signature)) {
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
