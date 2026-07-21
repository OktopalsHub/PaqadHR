import {
  buildTenantHost,
  getTenantSlugFromHost,
  getTenantSlugFromPath,
  isSubdomainTenantsEnabled,
  marketingOriginFromHost,
  subscribePagePath,
  tenantPath,
  tenantRoot,
  tenantUrl,
} from './tenant-routes';

describe('tenant-routes subdomain helpers', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_APP_DOMAIN = 'paqadhr.com';
    process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS = 'true';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('parses tenant slug from production subdomain host', () => {
    expect(getTenantSlugFromHost('acme.paqadhr.com')).toBe('acme');
  });

  it('parses tenant slug from dev subdomain host', () => {
    expect(getTenantSlugFromHost('acme.dev.paqadhr.com')).toBe('acme');
  });

  it('parses tenant slug from localhost subdomain host', () => {
    expect(getTenantSlugFromHost('acme.localhost:3000')).toBe('acme');
  });

  it('returns null for apex and reserved hosts', () => {
    expect(getTenantSlugFromHost('paqadhr.com')).toBeNull();
    expect(getTenantSlugFromHost('www.paqadhr.com')).toBeNull();
    expect(getTenantSlugFromHost('dev.paqadhr.com')).toBeNull();
    expect(getTenantSlugFromHost('api.paqadhr.com')).toBeNull();
  });

  it('resolves marketing apex from tenant dev subdomain host', () => {
    expect(marketingOriginFromHost('paqad.dev.paqadhr.com')).toBe('https://dev.paqadhr.com');
  });

  it('returns null for subscribe on apex path parsing', () => {
    expect(getTenantSlugFromPath('/subscribe')).toBeNull();
  });

  it('builds marketing subscribe URLs on apex', () => {
    expect(subscribePagePath({ welcome: true, workspace: 'acme' })).toBe(
      '/subscribe?welcome=1&workspace=acme',
    );
  });

  it('builds tenant URLs for subdomain mode', () => {
    expect(isSubdomainTenantsEnabled()).toBe(true);
    expect(buildTenantHost('acme')).toBe('acme.paqadhr.com');
    expect(tenantUrl('acme', '/dashboard')).toBe('https://acme.paqadhr.com/dashboard');
  });

  it('uses full tenant URLs for apex navigation in subdomain mode', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://dev.paqadhr.com';
    expect(tenantRoot('paqad')).toBe('https://paqad.dev.paqadhr.com/');
    expect(tenantPath('paqad', 'settings')).toBe('https://paqad.dev.paqadhr.com/settings');
  });
});
