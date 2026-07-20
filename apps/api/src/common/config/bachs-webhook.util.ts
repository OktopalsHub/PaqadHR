import { createHmac, timingSafeEqual } from 'node:crypto';
import { getBachsWebhookSecret } from 'src/common/config/bachs.config';

const TIMESTAMP_SKEW_SECONDS = 300;

export function verifyBachsWebhookSignature(
  rawBody: string,
  signature: string,
  timestamp: string,
): boolean {
  const secret = getBachsWebhookSecret();
  if (!secret || !signature?.trim() || !timestamp?.trim()) {
    return false;
  }

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > TIMESTAMP_SKEW_SECONDS) {
    return false;
  }

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) {
    return false;
  }

  return timingSafeEqual(sigBuf, expBuf);
}
