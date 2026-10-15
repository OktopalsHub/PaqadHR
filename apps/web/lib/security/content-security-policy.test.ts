import assert from 'node:assert/strict';
import test from 'node:test';
import { buildContentSecurityPolicy } from './content-security-policy.ts';
import { buildContentSecurityPolicyFromSources } from './content-security-policy-core.ts';

test('development CSP keeps eval and websocket sources for local tooling', () => {
  const csp = buildContentSecurityPolicyFromSources({
    apiOrigin: 'https://api-dev.paqadhr.com',
    brandOrigin: 'https://paqadhr.com',
    isDevelopment: true,
  });

  assert.equal(csp.includes("'unsafe-eval'"), true);
  const devScriptSrc = csp.split('; ').find((part) => part.startsWith('script-src')) ?? '';
  assert.equal(devScriptSrc.includes("'unsafe-inline'"), true);
  assert.equal(csp.includes(' ws:'), true);
  assert.equal(csp.includes(' wss:'), true);
});

test('production CSP excludes eval, websocket sources, and unsafe-inline when nonce is set', () => {
  const csp = buildContentSecurityPolicyFromSources({
    apiOrigin: 'https://prod.paqadhr.com',
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
    apiOrigin: 'https://prod.paqadhr.com',
    brandOrigin: 'https://paqadhr.com',
    isDevelopment: false,
  });

  const scriptSrc = csp.split('; ').find((part) => part.startsWith('script-src')) ?? '';
  assert.equal(scriptSrc.includes("'unsafe-inline'"), false);
});

test('CSP connect-src allows additional API origins', () => {
  const csp = buildContentSecurityPolicyFromSources({
    apiOrigin: 'https://api-dev.paqadhr.com',
    additionalApiOrigins: ['https://prod.paqadhr.com'],
    brandOrigin: 'https://paqadhr.com',
    isDevelopment: false,
    scriptNonce: 'abc123',
  });

  const connectSrc = csp.split('; ').find((part) => part.startsWith('connect-src')) ?? '';
  assert.equal(connectSrc.includes('https://api-dev.paqadhr.com'), true);
  assert.equal(connectSrc.includes('https://prod.paqadhr.com'), true);
});

test('CSP allows Bachs overlay script and iframe origins', () => {
  const csp = buildContentSecurityPolicyFromSources({
    apiOrigin: 'https://prod.paqadhr.com',
    brandOrigin: 'https://paqadhr.com',
    isDevelopment: false,
    scriptNonce: 'n1',
  });

  const scriptSrc = csp.split('; ').find((part) => part.startsWith('script-src')) ?? '';
  const frameSrc = csp.split('; ').find((part) => part.startsWith('frame-src')) ?? '';
  assert.equal(scriptSrc.includes('https://checkout.bachs.io'), true);
  assert.equal(frameSrc.includes('https://checkout.bachs.io'), true);
  assert.equal(frameSrc.includes('https://sandbox-checkout.bachs.io'), true);
});

test('CSP allows both the env API origin and the host-derived origin', () => {
  const previous = process.env.NEXT_PUBLIC_API_URL;
  // Simulate a stale runtime var (dev API) while the browser is on production.
  process.env.NEXT_PUBLIC_API_URL = 'https://api-dev.paqadhr.com';
  try {
    const csp = buildContentSecurityPolicy('paqadhr.com', 'abc123');
    const connectSrc = csp.split('; ').find((part) => part.startsWith('connect-src')) ?? '';
    assert.equal(connectSrc.includes('https://api-dev.paqadhr.com'), true);
    assert.equal(connectSrc.includes('https://prod.paqadhr.com'), true);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = previous;
  }
});
