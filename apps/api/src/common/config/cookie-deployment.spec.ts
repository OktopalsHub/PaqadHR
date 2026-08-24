import { resolveCookieDomain, usesCrossSiteCookies } from './cookie-deployment';

describe('cookie deployment configuration', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('uses host-only cookies for local development', () => {
    process.env.COOKIE_CROSS_SITE = 'false';
    process.env.APP_DOMAIN = 'localhost';

    expect(usesCrossSiteCookies()).toBe(false);
    expect(resolveCookieDomain()).toBeUndefined();
  });

  it('uses the configured parent domain for cross-site cookies', () => {
    process.env.COOKIE_CROSS_SITE = 'true';
    process.env.APP_DOMAIN = 'staging.paqadhr.com';

    expect(usesCrossSiteCookies()).toBe(true);
    expect(resolveCookieDomain()).toBe('.staging.paqadhr.com');
  });
});
