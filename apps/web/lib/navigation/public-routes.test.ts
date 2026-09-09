import assert from 'node:assert/strict';
import test from 'node:test';
import { skipsSessionBootstrap } from './public-routes.ts';

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
