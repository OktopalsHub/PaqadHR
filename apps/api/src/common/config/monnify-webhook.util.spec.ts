import { createHash, createHmac } from 'node:crypto';

jest.mock('./monnify.config', () => ({
  getMonnifyWebhookSecret: jest.fn(() => 'webhook-secret'),
}));

import { verifyMonnifyWebhookSignature } from './monnify-webhook.util';

describe('verifyMonnifyWebhookSignature', () => {
  const rawBody = '{"eventType":"SUCCESSFUL_TRANSACTION"}';

  it('returns false when signature is empty', () => {
    expect(verifyMonnifyWebhookSignature(rawBody, '')).toBe(false);
  });

  it('accepts valid HMAC-SHA512 signature', () => {
    const signature = createHmac('sha512', 'webhook-secret').update(rawBody).digest('hex');
    expect(verifyMonnifyWebhookSignature(rawBody, signature)).toBe(true);
  });

  it('accepts valid concat hash fallback', () => {
    const signature = createHash('sha512').update(`webhook-secret${rawBody}`).digest('hex');
    expect(verifyMonnifyWebhookSignature(rawBody, signature)).toBe(true);
  });

  it('rejects invalid signature', () => {
    expect(verifyMonnifyWebhookSignature(rawBody, 'not-a-valid-signature')).toBe(false);
  });
});
