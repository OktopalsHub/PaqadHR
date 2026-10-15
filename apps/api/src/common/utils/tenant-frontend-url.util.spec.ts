import {
  buildTenantHost,
  isAllowedTenantFrontendOrigin,
  isSubdomainTenantsEnabled,
  tenantFrontendUrl,
} from './tenant-frontend-url.util';

describe('tenant-frontend-url.util', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.FRONTEND_URL = 'https://paqadhr.com';
    process.env.APP_DOMAIN = 'paqadhr.com';
    process.env.APP_USE_SUBDOMAIN = 'true';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('builds tenant subdomain hosts', () => {
    expect(isSubdomainTenantsEnabled()).toBe(true);
    expect(buildTenantHost('acme')).toBe('acme.paqadhr.com');
    expect(tenantFrontendUrl('acme', '/settings?tab=billing')).toBe(
      'https://acme.paqadhr.com/settings?tab=billing',
    );
  });

  it('allows tenant subdomain origins during validation', () => {
    expect(isAllowedTenantFrontendOrigin('acme', 'https://acme.paqadhr.com')).toBe(true);
    expect(isAllowedTenantFrontendOrigin('acme', 'https://evil.example.com')).toBe(false);
  });
});
