import assert from 'node:assert/strict';
import test from 'node:test';
import { skipsSessionBootstrap } from './public-routes.ts';

test('skips the session bootstrap on public credential routes', () => {
  assert.equal(skipsSessionBootstrap('/signin'), true);
  assert.equal(skipsSessionBootstrap('/signup'), true);
  assert.equal(skipsSessionBootstrap('/reset-password'), true);
});

test('keeps the session bootstrap for protected routes', () => {
  assert.equal(skipsSessionBootstrap('/onboarding'), false);
});
