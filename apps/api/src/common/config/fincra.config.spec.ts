import { createHmac } from 'node:crypto';
import {
  getFincraBaseUrl,
  isAllowedFincraBaseUrl,
  isFincraAllowUnsignedWebhooks,
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
    delete process.env.FINCRA_ALLOW_UNSIGNED_WEBHOOKS;
    delete process.env.NODE_ENV;
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

  it('allows unsigned webhooks only in local development', () => {
    process.env.FINCRA_ALLOW_UNSIGNED_WEBHOOKS = 'true';
    process.env.NODE_ENV = 'development';
    expect(isFincraAllowUnsignedWebhooks()).toBe(true);

    process.env.NODE_ENV = 'production';
    expect(isFincraAllowUnsignedWebhooks()).toBe(false);
  });

  it('restricts FINCRA_BASE_URL overrides to HTTPS Fincra hosts', () => {
    expect(isAllowedFincraBaseUrl('https://api.fincra.com')).toBe(true);
    expect(isAllowedFincraBaseUrl('https://sandboxapi.fincra.com')).toBe(true);
    expect(isAllowedFincraBaseUrl('http://api.fincra.com')).toBe(false);
    expect(isAllowedFincraBaseUrl('https://evil.example.com')).toBe(false);

    process.env.FINCRA_BASE_URL = 'http://api.fincra.com';
    expect(() => getFincraBaseUrl()).toThrow('FINCRA_BASE_URL must use HTTPS');
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
