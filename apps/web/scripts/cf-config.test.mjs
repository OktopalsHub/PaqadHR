import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveBuildEnvironment, resolveWorkerConfig } from './cf-config.mjs';

const envFixture = (overrides = {}) => ({
  CF_WORKER_NAME: 'test-worker',
  CF_COMPAT_DATE: '2026-10-15',
  NEXT_PUBLIC_API_URL: 'https://api.example.test',
  NEXT_PUBLIC_APP_URL: 'https://app.example.test',
  NEXT_PUBLIC_APP_DOMAIN: 'example.test',
  NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS: 'false',
  ...overrides,
});

test('reads Worker settings and public URLs from environment values', () => {
  const config = resolveWorkerConfig(
    envFixture({
      CF_WORKER_NAME: 'custom-worker',
      CF_COMPAT_DATE: '2026-10-16',
      NEXT_PUBLIC_API_URL: 'https://api.custom.test',
      NEXT_PUBLIC_APP_URL: 'https://custom.test',
      NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS: 'true',
      CF_ROUTES: '[{"pattern":"custom.test","custom_domain":true}]',
    }),
  );

  assert.equal(config.name, 'custom-worker');
  assert.equal(config.compatibility_date, '2026-10-16');
  assert.equal(config.vars.NEXT_PUBLIC_API_URL, 'https://api.custom.test');
  assert.equal(config.vars.NEXT_PUBLIC_APP_URL, 'https://custom.test');
  assert.equal(config.vars.NEXT_PUBLIC_APP_DOMAIN, 'example.test');
  assert.equal(config.vars.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS, 'true');
  assert.deepEqual(config.routes, [{ pattern: 'custom.test', custom_domain: true }]);
});

test('requires environment values instead of using embedded URL or Worker defaults', () => {
  assert.throws(() => resolveBuildEnvironment({}), /NEXT_PUBLIC_API_URL/);
  assert.throws(() => resolveWorkerConfig({}), /CF_WORKER_NAME/);
  assert.throws(
    () => resolveBuildEnvironment(envFixture({ NEXT_PUBLIC_APP_URL: '' })),
    /NEXT_PUBLIC_APP_URL/,
  );
  assert.throws(
    () => resolveBuildEnvironment(envFixture({ NEXT_PUBLIC_API_URL: '' })),
    /NEXT_PUBLIC_API_URL/,
  );
  assert.throws(
    () => resolveWorkerConfig(envFixture({ CF_COMPAT_DATE: '' })),
    /CF_COMPAT_DATE/,
  );
});

test('preserves environment values while normalizing required variables', () => {
  const env = envFixture({ CUSTOM_VALUE: 'preserved' });
  const resolved = resolveBuildEnvironment(env);

  assert.equal(resolved.CUSTOM_VALUE, 'preserved');
  assert.equal(resolved.NEXT_PUBLIC_APP_URL, env.NEXT_PUBLIC_APP_URL);
  assert.equal(resolved.NEXT_PUBLIC_API_URL, env.NEXT_PUBLIC_API_URL);
  assert.equal(resolved.NEXT_PUBLIC_APP_DOMAIN, env.NEXT_PUBLIC_APP_DOMAIN);
});

test('supports omitted routes and disables workers.dev by default', () => {
  const config = resolveWorkerConfig(envFixture());

  assert.deepEqual(config.routes, []);
  assert.equal(config.workers_dev, false);
});

test('ignores blank CF_ROUTES and trims configured routes', () => {
  const config = resolveWorkerConfig(
    envFixture({
      CF_ROUTES: ' [{"pattern":"example.test","custom_domain":true}] ',
    }),
  );

  assert.deepEqual(config.routes, [{ pattern: 'example.test', custom_domain: true }]);
});

test('fails with a clear error on malformed CF_ROUTES', () => {
  assert.throws(() => resolveWorkerConfig(envFixture({ CF_ROUTES: 'not-json' })), /CF_ROUTES/);
  assert.throws(
    () => resolveWorkerConfig(envFixture({ CF_ROUTES: '{"pattern":"x"}' })),
    /CF_ROUTES/,
  );
});
