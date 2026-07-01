import { createHmac, timingSafeEqual } from 'node:crypto';
import { getNombaWebhookSecret } from './nomba.config';

export function verifyNombaWebhookSignature(rawBody: string, signature: string): boolean {
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

    const hashingPayload = `${eventType}:${requestId}:${userId}:${walletId}:${transactionId}:${transactionType}:${transactionTime}:${responseCode}:${transactionTime}`;
    const hash = createHmac('sha256', secret).update(hashingPayload).digest('base64');

    if (
      hash.length === signature.length &&
      timingSafeEqual(Buffer.from(hash, 'utf8'), Buffer.from(signature, 'utf8'))
    ) {
      return true;
    }
  } catch {
    // ponytail: fallback below
  }

  try {
    const hash = createHmac('sha256', secret).update(rawBody).digest('hex');
    if (
      hash.length === signature.length &&
      timingSafeEqual(Buffer.from(hash, 'utf8'), Buffer.from(signature, 'utf8'))
    ) {
      return true;
    }
  } catch {
    // ignore
  }

  return false;
}
