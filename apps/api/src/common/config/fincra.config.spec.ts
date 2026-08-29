import { createHmac } from 'node:crypto';
import {
  getFincraBaseUrl,
  isFincraConfigured,
  isFincraLive,
} from './fincra.config';

describe('fincra.config', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.FINCRA_LIVE;
    delete process.env.FINCRA_BASE_URL;
    delete process.env.FINCRA_API_KEY;
    delete process.env.FINCRA_BUSINESS_ID;
    delete process.env.FINCRA_PUBLIC_KEY;
  });

  afterAll(() => {
    process.env = env;
  });

  it('detects sandbox vs live base URL', () => {
    expect(getFincraBaseUrl()).toContain('sandboxapi.fincra.com');
    process.env.FINCRA_LIVE = 'true';
    expect(getFincraBaseUrl()).toContain('api.fincra.com');
    expect(isFincraLive()).toBe(true);
  });

  it('is configured when api key and business id are set', () => {
    expect(isFincraConfigured()).toBe(false);
    process.env.FINCRA_API_KEY = 'key';
    process.env.FINCRA_BUSINESS_ID = 'biz';
    expect(isFincraConfigured()).toBe(true);
  });
});

describe('fincra webhook signature', () => {
  it('verifies HMAC-SHA512 over parsed payload', async () => {
    const { verifyFincraWebhookSignature } = await import('./fincra-webhook.util');
    const secret = 'test-webhook-secret';
    process.env.FINCRA_WEBHOOK_SECRET = secret;
    const payload = {
      event: 'payout.successful',
      data: { customerReference: 'payroll_test', status: 'successful' },
    };
    const signature = createHmac('sha512', secret).update(JSON.stringify(payload)).digest('hex');
    expect(verifyFincraWebhookSignature(JSON.stringify(payload), signature)).toBe(true);
    expect(verifyFincraWebhookSignature(JSON.stringify(payload), 'bad')).toBe(false);
  });
});
