import { createHmac } from 'node:crypto';
import {
  getTremendousWebhookSecret,
  isAllowedTremendousUrl,
  verifyTremendousWebhookSignature,
} from './tremendous-webhook.util';

describe('tremendous webhook validation', () => {
  const originalSecret = process.env.TREMENDOUS_WEBHOOK_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.TREMENDOUS_WEBHOOK_SECRET;
    } else {
      process.env.TREMENDOUS_WEBHOOK_SECRET = originalSecret;
    }
  });

  it('accepts a valid Tremendous webhook signature', () => {
    const secret = 'test-webhook-secret';
    const rawBody = '{"id":"delivery_123"}';
    process.env.TREMENDOUS_WEBHOOK_SECRET = secret;

    const signature = createHmac('sha256', secret).update(rawBody).digest('hex');

    expect(verifyTremendousWebhookSignature(rawBody, signature)).toBe(true);
  });

  it('rejects an invalid webhook signature', () => {
    process.env.TREMENDOUS_WEBHOOK_SECRET = 'test-webhook-secret';

    expect(verifyTremendousWebhookSignature('{"id":"delivery_123"}', 'invalid')).toBe(false);
  });

  it('rejects a webhook when the secret is missing', () => {
    delete process.env.TREMENDOUS_WEBHOOK_SECRET;

    expect(verifyTremendousWebhookSignature('{"id":"delivery_123"}', 'signature')).toBe(false);
  });

  it('rejects a webhook when the signature is missing', () => {
    process.env.TREMENDOUS_WEBHOOK_SECRET = 'test-webhook-secret';

    expect(verifyTremendousWebhookSignature('{"id":"delivery_123"}', '')).toBe(false);
  });

  it('allows Tremendous HTTPS URLs and permitted subdomains', () => {
    expect(isAllowedTremendousUrl('https://tremendous.com/delivery/123')).toBe(true);
    expect(isAllowedTremendousUrl('https://api.tremendous.com/delivery/123')).toBe(true);
    expect(isAllowedTremendousUrl('https://rewards.tremendous.com/claim/123')).toBe(true);
  });

  it('rejects HTTP Tremendous URLs', () => {
    expect(isAllowedTremendousUrl('http://tremendous.com/delivery/123')).toBe(false);
  });

  it('rejects lookalike Tremendous domains', () => {
    expect(isAllowedTremendousUrl('https://tremendous.com.evil.example/delivery/123')).toBe(false);
    expect(isAllowedTremendousUrl('https://tremendous-example.com/delivery/123')).toBe(false);
  });
});
