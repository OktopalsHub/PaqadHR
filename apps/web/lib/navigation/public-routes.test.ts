import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldHardRedirectOnRefreshExpiry } from '../api/auth-refresh.ts';
import { isPublicAuthOrMarketingPath, skipsSessionBootstrap } from './public-routes.ts';

test('skips session bootstrap on public credential and marketing routes', () => {
  assert.equal(skipsSessionBootstrap('/signup'), true);
  assert.equal(skipsSessionBootstrap('/reset-password'), true);
  assert.equal(skipsSessionBootstrap('/terms'), true);
  assert.equal(skipsSessionBootstrap('/privacy'), true);
});

test('probes session on landing and sign-in for silent restore', () => {
  assert.equal(skipsSessionBootstrap('/'), false);
  assert.equal(skipsSessionBootstrap('/signin'), false);
});

test('keeps the session bootstrap for protected routes', () => {
  assert.equal(skipsSessionBootstrap('/onboarding'), false);
});

test('marks landing and credential pages as public for soft refresh expiry', () => {
  assert.equal(isPublicAuthOrMarketingPath('/'), true);
  assert.equal(isPublicAuthOrMarketingPath('/signin'), true);
  assert.equal(isPublicAuthOrMarketingPath('/signup'), true);
  assert.equal(isPublicAuthOrMarketingPath('/terms'), true);
  assert.equal(isPublicAuthOrMarketingPath('/acme/employees'), false);
  assert.equal(isPublicAuthOrMarketingPath('/onboarding'), false);
});

test('refresh expiry hard-redirects only off public auth or marketing paths', () => {
  assert.equal(shouldHardRedirectOnRefreshExpiry('/signin'), false);
  assert.equal(shouldHardRedirectOnRefreshExpiry('/'), false);
  assert.equal(shouldHardRedirectOnRefreshExpiry('/signup'), false);
  assert.equal(shouldHardRedirectOnRefreshExpiry('/acme/employees'), true);
  assert.equal(shouldHardRedirectOnRefreshExpiry('/onboarding'), true);
});
