import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveBuildEnvironment, resolveWorkerConfig } from './cf-config.mjs';

test('resolves every env-driven value when provided', () => {
  const config = resolveWorkerConfig({
    WORKERS_CI_BRANCH: 'main',
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

test('defaults worker and URLs per branch', () => {
  const production = resolveWorkerConfig({ WORKERS_CI_BRANCH: 'main' });
  assert.equal(production.name, 'paqadhr');
  assert.equal(production.vars.NEXT_PUBLIC_APP_URL, 'https://paqadhr.com');
  assert.equal(production.vars.NEXT_PUBLIC_API_URL, 'https://prod.paqadhr.com');

  assert.equal(resolveWorkerConfig({ GITHUB_REF_NAME: 'main' }).name, 'paqadhr');

  const development = resolveWorkerConfig({ WORKERS_CI_BRANCH: 'dev' });
  assert.equal(development.name, 'paqadhr-dev');
  assert.equal(development.vars.NEXT_PUBLIC_APP_URL, 'https://dev.paqadhr.com');
  assert.equal(development.vars.NEXT_PUBLIC_API_URL, 'https://api-dev.paqadhr.com');

  assert.equal(resolveWorkerConfig({ WORKERS_CI_BRANCH: 'feature/x' }).name, 'paqadhr-dev');
});

test('CF_WORKER_NAME overrides the branch default', () => {
  assert.equal(
    resolveWorkerConfig({ WORKERS_CI_BRANCH: 'main', CF_WORKER_NAME: 'paqadhr-preview' }).name,
    'paqadhr-preview',
  );
});

test('build environment defaults public URLs according to branch', () => {
  const production = resolveBuildEnvironment({ WORKERS_CI_BRANCH: 'main' });
  assert.equal(production.NEXT_PUBLIC_APP_URL, 'https://paqadhr.com');
  assert.equal(production.NEXT_PUBLIC_API_URL, 'https://prod.paqadhr.com');

  const development = resolveBuildEnvironment({ WORKERS_CI_BRANCH: 'dev' });
  assert.equal(development.NEXT_PUBLIC_APP_URL, 'https://dev.paqadhr.com');
  assert.equal(development.NEXT_PUBLIC_API_URL, 'https://api-dev.paqadhr.com');
});

test('fails closed when main/dev has the other environment URLs configured', () => {
  assert.throws(
    () => resolveBuildEnvironment({
      WORKERS_CI_BRANCH: 'main',
      NEXT_PUBLIC_APP_URL: 'https://dev.paqadhr.com',
    }),
    /main build has NEXT_PUBLIC_APP_URL set to the dev URL/,
  );
  assert.throws(
    () => resolveBuildEnvironment({
      WORKERS_CI_BRANCH: 'dev',
      NEXT_PUBLIC_API_URL: 'https://prod.paqadhr.com',
    }),
    /dev build has NEXT_PUBLIC_API_URL set to the production API/,
  );
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
