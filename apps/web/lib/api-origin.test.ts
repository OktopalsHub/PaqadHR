import assert from 'node:assert/strict';
import test from 'node:test';
import { apiOriginFromBase, resolveApiBaseUrl, resolveHostApiBaseUrl } from './api-origin.ts';

/** Runs `fn` with NEXT_PUBLIC_API_URL unset so host-based resolution is exercised. */
function withoutApiEnv(fn: () => void): void {
  const previous = process.env.NEXT_PUBLIC_API_URL;
  process.env.NEXT_PUBLIC_API_URL = '';
  try {
    fn();
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = previous;
  }
}

test('resolveApiBaseUrl prefers an explicit URL over the request host', () => {
  assert.equal(
    resolveApiBaseUrl({ envUrl: 'https://prod.paqadhr.com/', requestHost: 'dev.paqadhr.com' }),
    'https://prod.paqadhr.com',
  );
});

test('resolveApiBaseUrl falls back to the request host when no URL is set', () => {
  withoutApiEnv(() => {
    assert.equal(resolveApiBaseUrl({ requestHost: 'paqadhr.com' }), 'https://prod.paqadhr.com');
    assert.equal(
      resolveApiBaseUrl({ requestHost: 'dev.paqadhr.com' }),
      'https://api-dev.paqadhr.com',
    );
    assert.equal(
      resolveApiBaseUrl({ requestHost: 'acme.paqadhr.com' }),
      'https://prod.paqadhr.com',
    );
  });
});

test('resolveHostApiBaseUrl ignores env overrides and only maps the host', () => {
  assert.equal(resolveHostApiBaseUrl('paqadhr.com'), 'https://prod.paqadhr.com');
  assert.equal(resolveHostApiBaseUrl('www.paqadhr.com'), 'https://prod.paqadhr.com');
  assert.equal(resolveHostApiBaseUrl('acme.dev.paqadhr.com'), 'https://api-dev.paqadhr.com');
  assert.equal(resolveHostApiBaseUrl('example.com'), undefined);
  assert.equal(resolveHostApiBaseUrl(undefined), undefined);
});

test('apiOriginFromBase strips the /api/v1 suffix', () => {
  assert.equal(apiOriginFromBase('https://prod.paqadhr.com/api/v1'), 'https://prod.paqadhr.com');
  assert.equal(apiOriginFromBase('https://prod.paqadhr.com/api'), 'https://prod.paqadhr.com');
  assert.equal(apiOriginFromBase('https://prod.paqadhr.com'), 'https://prod.paqadhr.com');
});
