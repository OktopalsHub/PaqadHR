import { createHmac } from 'node:crypto';
import { verifyNombaWebhookSignature } from './nomba-webhook.util';

describe('verifyNombaWebhookSignature', () => {
  const secret = 'test-webhook-secret';
  const timestamp = '2025-09-29T10:51:44Z';

  const payload = {
    event_type: 'payment_success',
    requestId: 'req-1',
    data: {
      merchant: { userId: 'user-1', walletId: 'wallet-1' },
      transaction: {
        transactionId: 'txn-1',
        type: 'online_checkout',
        time: '2025-09-29T10:50:00Z',
        responseCode: '',
      },
    },
  };

  beforeEach(() => {
    process.env.NOMBA_WEBHOOK_SIGNATURE_KEY = secret;
  });

  afterEach(() => {
    delete process.env.NOMBA_WEBHOOK_SIGNATURE_KEY;
  });

  it('accepts signatures built with nomba-timestamp as the last field', () => {
    const rawBody = JSON.stringify(payload);
    const hashingPayload =
      'payment_success:req-1:user-1:wallet-1:txn-1:online_checkout:2025-09-29T10:50:00Z::2025-09-29T10:51:44Z';
    const signature = createHmac('sha256', secret).update(hashingPayload).digest('base64');

    expect(verifyNombaWebhookSignature(rawBody, signature, timestamp)).toBe(true);
  });

  it('rejects signatures that incorrectly reuse transaction.time as the timestamp', () => {
    const rawBody = JSON.stringify(payload);
    const wrongPayload =
      'payment_success:req-1:user-1:wallet-1:txn-1:online_checkout:2025-09-29T10:50:00Z::2025-09-29T10:50:00Z';
    const signature = createHmac('sha256', secret).update(wrongPayload).digest('base64');

    expect(verifyNombaWebhookSignature(rawBody, signature, timestamp)).toBe(false);
  });
});
