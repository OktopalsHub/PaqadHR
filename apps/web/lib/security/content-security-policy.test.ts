import assert from 'node:assert/strict';
import test from 'node:test';
import { buildContentSecurityPolicyFromSources } from './content-security-policy-core.ts';

test('development CSP keeps eval and websocket sources for local tooling', () => {
  const csp = buildContentSecurityPolicyFromSources({
    apiOrigin: 'https://api-dev.paqadhr.com',
    brandOrigin: 'https://paqadhr.com',
    isDevelopment: true,
  });

  assert.equal(csp.includes("'unsafe-eval'"), true);
  assert.equal(csp.includes(' ws:'), true);
  assert.equal(csp.includes(' wss:'), true);
});

test('production CSP excludes eval and websocket sources', () => {
  const csp = buildContentSecurityPolicyFromSources({
    apiOrigin: 'https://api.paqadhr.com',
    brandOrigin: 'https://paqadhr.com',
    isDevelopment: false,
  });

  assert.equal(csp.includes("'unsafe-eval'"), false);
  assert.equal(csp.includes(' ws:'), false);
  assert.equal(csp.includes(' wss:'), false);
});
