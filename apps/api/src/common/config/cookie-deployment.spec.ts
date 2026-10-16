import {
  ACCESS_TOKEN_COOKIE,
  CSRF_COOKIE,
  cookieName,
  REFRESH_TOKEN_COOKIE,
  resolveCookieDomain,
  resolveCookieNamePrefix,
  usesCrossSiteCookies,
  usesSecureCookies,
} from './cookie-deployment';

describe('cookie deployment configuration', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('uses host-only cookies for local development', () => {
    process.env.COOKIE_CROSS_SITE = 'false';
    process.env.APP_DOMAIN = 'localhost';

    expect(usesCrossSiteCookies()).toBe(false);
    expect(usesSecureCookies()).toBe(false);
    expect(resolveCookieDomain()).toBeUndefined();
  });

  it('uses the configured parent domain for cross-site cookies', () => {
    process.env.COOKIE_CROSS_SITE = 'true';
    process.env.APP_DOMAIN = 'staging.paqadhr.com';

    expect(usesCrossSiteCookies()).toBe(true);
    expect(usesSecureCookies()).toBe(true);
    expect(resolveCookieDomain()).toBe('.staging.paqadhr.com');
  });

  it('uses secure cookies in production even for same-site deployments', () => {
    process.env.NODE_ENV = 'production';
    process.env.COOKIE_CROSS_SITE = 'false';

    expect(usesSecureCookies()).toBe(true);
  });

  describe('cookie name prefix', () => {
    it('keeps production cookie names unnamespaced', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.COOKIE_NAME_PREFIX;

      expect(resolveCookieNamePrefix()).toBe('');
      expect(cookieName(ACCESS_TOKEN_COOKIE)).toBe('access_token');
      expect(cookieName(REFRESH_TOKEN_COOKIE)).toBe('refresh_token');
      expect(cookieName(CSRF_COOKIE)).toBe('_csrf');
    });

    it('namespaces cookie names outside production', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.COOKIE_NAME_PREFIX;

      expect(resolveCookieNamePrefix()).toBe('dev_');
      expect(cookieName(ACCESS_TOKEN_COOKIE)).toBe('dev_access_token');
      expect(cookieName(REFRESH_TOKEN_COOKIE)).toBe('dev_refresh_token');
      expect(cookieName('google_oauth_consent')).toBe('dev_google_oauth_consent');
      // csurf's leading underscore must not double up with the prefix.
      expect(cookieName(CSRF_COOKIE)).toBe('dev_csrf');
    });

    it('accepts an explicit prefix with or without a trailing underscore', () => {
      process.env.NODE_ENV = 'production';
      process.env.COOKIE_NAME_PREFIX = 'staging';
      expect(cookieName(ACCESS_TOKEN_COOKIE)).toBe('staging_access_token');

      process.env.COOKIE_NAME_PREFIX = 'staging_';
      expect(cookieName(ACCESS_TOKEN_COOKIE)).toBe('staging_access_token');
    });

    it('falls back to the environment default when the prefix is blank', () => {
      process.env.NODE_ENV = 'development';
      process.env.COOKIE_NAME_PREFIX = '   ';

      expect(cookieName(ACCESS_TOKEN_COOKIE)).toBe('dev_access_token');
    });
  });
});
