import assert from 'node:assert/strict';
import test from 'node:test';
import { buildContentSecurityPolicyFromSources } from './content-security-policy-core.ts';

test('development CSP keeps eval and websocket sources for local tooling', () => {
  const csp = buildContentSecurityPolicyFromSources({
    apiOrigin: 'https://api-dev.paqadhr.com',
    brandOrigin: 'https://paqadhr.com',
    isDevelopment: true,
  });

  assert.equal(csp.includes("'unsafe-inline'"), true);
  assert.equal(csp.includes("'unsafe-eval'"), true);
  assert.equal(csp.includes(' ws:'), true);
  assert.equal(csp.includes(' wss:'), true);
});

test('production CSP excludes eval, websocket sources, and unsafe-inline when nonce is set', () => {
  const csp = buildContentSecurityPolicyFromSources({
    apiOrigin: 'https://api.paqadhr.com',
    brandOrigin: 'https://paqadhr.com',
    isDevelopment: false,
    scriptNonce: 'abc123',
  });

  assert.equal(csp.includes("'unsafe-eval'"), false);
  assert.equal(csp.includes(' ws:'), false);
  assert.equal(csp.includes(' wss:'), false);
  const scriptSrc = csp.split('; ').find((part) => part.startsWith('script-src')) ?? '';
  assert.equal(scriptSrc.includes("'unsafe-inline'"), false);
  assert.equal(scriptSrc.includes("'nonce-abc123'"), true);
});

test('production CSP without nonce omits unsafe-inline from script-src', () => {
  const csp = buildContentSecurityPolicyFromSources({
    apiOrigin: 'https://api.paqadhr.com',
    brandOrigin: 'https://paqadhr.com',
    isDevelopment: false,
  });

  const scriptSrc = csp.split('; ').find((part) => part.startsWith('script-src')) ?? '';
  assert.equal(scriptSrc.includes("'unsafe-inline'"), false);
});
