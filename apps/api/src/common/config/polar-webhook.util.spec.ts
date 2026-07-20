import { createHmac } from 'node:crypto';
import { extractPolarWebhookHeaders, verifyPolarWebhookSignature } from './polar-webhook.util';

describe('polar-webhook.util', () => {
  const signingKey = Buffer.from('test_secret_key_for_hmac!!');
  const secret = `whsec_${signingKey.toString('base64')}`;
  const rawBody = JSON.stringify({ type: 'order.paid', data: { id: 'ord_1' } });

  beforeEach(() => {
    process.env.POLAR_WEBHOOK_SECRET = secret;
  });

  afterEach(() => {
    delete process.env.POLAR_WEBHOOK_SECRET;
  });

  function sign(body: string, webhookId: string, timestamp: string): string {
    const signedContent = `${webhookId}.${timestamp}.${body}`;
    const digest = createHmac('sha256', signingKey).update(signedContent).digest('base64');
    return `v1,${digest}`;
  }

  it('extracts Standard Webhooks headers', () => {
    expect(
      extractPolarWebhookHeaders({
        'webhook-id': 'msg_123',
        'webhook-timestamp': '1700000000',
        'webhook-signature': 'v1,abc',
      }),
    ).toEqual({
      webhookId: 'msg_123',
      timestamp: '1700000000',
      signature: 'v1,abc',
    });
  });

  it('accepts valid Polar webhook signatures with whsec secret', () => {
    const webhookId = 'msg_123';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = sign(rawBody, webhookId, timestamp);

    expect(
      verifyPolarWebhookSignature(rawBody, {
        webhookId,
        timestamp,
        signature,
      }),
    ).toBe(true);
  });

  it('rejects invalid signatures', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    expect(
      verifyPolarWebhookSignature(rawBody, {
        webhookId: 'msg_123',
        timestamp,
        signature: 'v1,invalid',
      }),
    ).toBe(false);
  });
});
