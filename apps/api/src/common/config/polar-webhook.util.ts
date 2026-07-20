import { createHmac, timingSafeEqual } from 'node:crypto';
import { getPolarWebhookSecret } from 'src/common/config/polar.config';

const TIMESTAMP_SKEW_SECONDS = 300;

function polarWebhookSigningKey(secret: string): Buffer | string {
  const trimmed = secret.trim();
  if (trimmed.startsWith('whsec_')) {
    return Buffer.from(trimmed.slice('whsec_'.length), 'base64');
  }
  if (trimmed.startsWith('polar_whs_')) {
    return Buffer.from(trimmed.slice('polar_whs_'.length), 'base64');
  }
  return trimmed;
}

export type PolarWebhookHeaders = {
  webhookId: string;
  timestamp: string;
  signature: string;
};

export function extractPolarWebhookHeaders(
  headers: Record<string, string | string[] | undefined>,
): PolarWebhookHeaders | null {
  const webhookId = getHeader(headers, 'webhook-id');
  const timestamp = getHeader(headers, 'webhook-timestamp');
  const signature = getHeader(headers, 'webhook-signature');
  if (!webhookId || !timestamp || !signature) {
    return null;
  }
  return { webhookId, timestamp, signature };
}

export function verifyPolarWebhookSignature(
  rawBody: string,
  headers: PolarWebhookHeaders,
): boolean {
  const secret = getPolarWebhookSecret();
  if (!secret) {
    return false;
  }

  const timestampSeconds = Number(headers.timestamp);
  if (!Number.isFinite(timestampSeconds)) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > TIMESTAMP_SKEW_SECONDS) {
    return false;
  }

  const signedContent = `${headers.webhookId}.${headers.timestamp}.${rawBody}`;
  const signingKey = polarWebhookSigningKey(secret);
  const expected = createHmac('sha256', signingKey).update(signedContent).digest('base64');

  return headers.signature.split(' ').some((part) => {
    const [, value] = part.split(',');
    if (!value) {
      return false;
    }
    const sigBuf = Buffer.from(value);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) {
      return false;
    }
    return timingSafeEqual(sigBuf, expBuf);
  });
}

function getHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | null {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
