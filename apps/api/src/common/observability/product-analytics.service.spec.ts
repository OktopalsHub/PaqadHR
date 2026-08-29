import { ProductAnalyticsService } from './product-analytics.service';
import { sanitizeAnalyticsProperties } from './sanitize-analytics-properties';

describe('sanitizeAnalyticsProperties', () => {
  it('keeps allowlisted properties and drops PII fields', () => {
    expect(
      sanitizeAnalyticsProperties({
        tenant_id: 'tenant-1',
        role: 'admin',
        plan: 'growth',
        provider: 'nomba',
        email: 'secret@x.com',
        accountNumber: '1234567890',
        salary: 500000,
      }),
    ).toEqual({
      tenant_id: 'tenant-1',
      role: 'admin',
      plan: 'growth',
      provider: 'nomba',
    });
  });
});

describe('ProductAnalyticsService', () => {
  const originalApiKey = process.env.POSTHOG_API_KEY;

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.POSTHOG_API_KEY;
    } else {
      process.env.POSTHOG_API_KEY = originalApiKey;
    }
  });

  it('no-ops capture when POSTHOG_API_KEY is unset', () => {
    delete process.env.POSTHOG_API_KEY;
    const service = new ProductAnalyticsService();

    expect(() => {
      service.capture('user-1', 'login_succeeded', { userId: 'user-1' });
    }).not.toThrow();
  });
});
