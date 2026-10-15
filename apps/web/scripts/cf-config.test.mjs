import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveWorkerConfig } from './cf-config.mjs';

test('resolves every env-driven value when provided', () => {
  const config = resolveWorkerConfig({
    CF_WORKER_NAME: 'paqadhr-main',
    CF_COMPAT_DATE: '2026-10-15',
    NEXT_PUBLIC_API_URL: 'https://prod.paqadhr.com',
    NEXT_PUBLIC_APP_URL: 'https://paqadhr.com',
    NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS: 'false',
    CF_ROUTES: '[{"pattern":"paqadhr.com","custom_domain":true}]',
  });

  assert.equal(config.name, 'paqadhr-main');
  assert.equal(config.compatibility_date, '2026-10-15');
  assert.equal(config.vars.NEXT_PUBLIC_API_URL, 'https://prod.paqadhr.com');
  assert.equal(config.vars.NEXT_PUBLIC_APP_URL, 'https://paqadhr.com');
  assert.equal(config.vars.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS, 'false');
  assert.deepEqual(config.routes, [{ pattern: 'paqadhr.com', custom_domain: true }]);
});

test('falls back to the dev worker and no routes', () => {
  const config = resolveWorkerConfig({});

  assert.equal(config.name, 'paqadhr-dev');
  assert.deepEqual(config.routes, []);
  assert.equal(config.workers_dev, false);
  assert.equal(config.vars.NEXT_PUBLIC_API_URL, 'https://api-dev.paqadhr.com');
  assert.equal(config.vars.NEXT_PUBLIC_APP_URL, 'https://dev.paqadhr.com');
  assert.equal(config.compatibility_date, '2026-07-01');
});

test('ignores blank env values and trims CF_ROUTES', () => {
  const config = resolveWorkerConfig({
    CF_WORKER_NAME: '   ',
    CF_ROUTES: ' [{"pattern":"*.dev.paqadhr.com/*","zone_name":"paqadhr.com"}] ',
  });

  assert.equal(config.name, 'paqadhr-dev');
  assert.deepEqual(config.routes, [{ pattern: '*.dev.paqadhr.com/*', zone_name: 'paqadhr.com' }]);
});

test('fails with a clear error on malformed CF_ROUTES', () => {
  assert.throws(() => resolveWorkerConfig({ CF_ROUTES: 'not-json' }), /CF_ROUTES/);
  assert.throws(() => resolveWorkerConfig({ CF_ROUTES: '{"pattern":"x"}' }), /CF_ROUTES/);
});
