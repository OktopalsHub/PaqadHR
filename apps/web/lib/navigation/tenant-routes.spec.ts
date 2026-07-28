import assert from 'node:assert/strict';
import test from 'node:test';
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
} from './tenant-routes.ts';

function withTenantEnv<T>(run: () => T): T {
  const previousEnv = process.env;
  process.env = {
    ...previousEnv,
    NEXT_PUBLIC_APP_DOMAIN: 'paqadhr.com',
    NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS: 'true',
  };

  try {
    return run();
  } finally {
    process.env = previousEnv;
  }
}

test('parses tenant slug from production subdomain host', () => {
  withTenantEnv(() => {
    assert.equal(getTenantSlugFromHost('acme.paqadhr.com'), 'acme');
  });
});

test('parses tenant slug from dev subdomain host', () => {
  withTenantEnv(() => {
    assert.equal(getTenantSlugFromHost('acme.dev.paqadhr.com'), 'acme');
  });
});

test('parses tenant slug from localhost subdomain host', () => {
  withTenantEnv(() => {
    assert.equal(getTenantSlugFromHost('acme.localhost:3000'), 'acme');
  });
});

test('returns null for apex and reserved hosts', () => {
  withTenantEnv(() => {
    assert.equal(getTenantSlugFromHost('paqadhr.com'), null);
    assert.equal(getTenantSlugFromHost('www.paqadhr.com'), null);
    assert.equal(getTenantSlugFromHost('dev.paqadhr.com'), null);
    assert.equal(getTenantSlugFromHost('api.paqadhr.com'), null);
  });
});

test('resolves marketing apex from tenant dev subdomain host', () => {
  withTenantEnv(() => {
    assert.equal(marketingOriginFromHost('paqad.dev.paqadhr.com'), 'https://dev.paqadhr.com');
  });
});

test('returns null for subscribe on apex path parsing', () => {
  withTenantEnv(() => {
    assert.equal(getTenantSlugFromPath('/subscribe'), null);
  });
});

test('builds marketing subscribe URLs on apex', () => {
  withTenantEnv(() => {
    assert.equal(
      subscribePagePath({ welcome: true, workspace: 'acme' }),
      '/subscribe?welcome=1&workspace=acme',
    );
  });
});

test('builds tenant URLs for subdomain mode', () => {
  withTenantEnv(() => {
    assert.equal(isSubdomainTenantsEnabled(), true);
    assert.equal(buildTenantHost('acme'), 'acme.paqadhr.com');
    assert.equal(tenantUrl('acme', '/dashboard'), 'https://acme.paqadhr.com/dashboard');
  });
});

test('uses full tenant URLs for apex navigation in subdomain mode', () => {
  withTenantEnv(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://dev.paqadhr.com';
    assert.equal(tenantRoot('paqad'), 'https://paqad.dev.paqadhr.com/');
    assert.equal(tenantPath('paqad', 'settings'), 'https://paqad.dev.paqadhr.com/settings');
  });
});
