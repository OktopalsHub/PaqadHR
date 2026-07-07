import { createHmac } from 'node:crypto';
import { verifyNoahWebhookSignature } from './noah-webhook.util';

describe('verifyNoahWebhookSignature', () => {
  const secret = 'test-noah-webhook-secret';
  const rawBody = JSON.stringify({ event_type: 'payment_success', data: { externalID: 'nw_abc' } });

  beforeEach(() => {
    process.env.NOAH_WEBHOOK_SECRET = secret;
  });

  afterEach(() => {
    delete process.env.NOAH_WEBHOOK_SECRET;
  });

  it('accepts valid HMAC signatures', () => {
    const signature = createHmac('sha256', secret).update(rawBody).digest('hex');
    expect(verifyNoahWebhookSignature(rawBody, signature)).toBe(true);
  });

  it('accepts sha256= prefixed signatures', () => {
    const signature = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
    expect(verifyNoahWebhookSignature(rawBody, signature)).toBe(true);
  });

  it('accepts timestamp-prefixed payload when timestamp is provided', () => {
    const timestamp = '2026-07-06T12:00:00Z';
    const signature = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
    expect(verifyNoahWebhookSignature(rawBody, signature, timestamp)).toBe(true);
  });

  it('rejects invalid signatures', () => {
    expect(verifyNoahWebhookSignature(rawBody, 'deadbeef')).toBe(false);
  });

  it('rejects when secret is not configured', () => {
    delete process.env.NOAH_WEBHOOK_SECRET;
    const signature = createHmac('sha256', secret).update(rawBody).digest('hex');
    expect(verifyNoahWebhookSignature(rawBody, signature)).toBe(false);
  });
});
