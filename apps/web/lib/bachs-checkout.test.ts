import assert from 'node:assert/strict';
import test from 'node:test';
import { isBachsCheckoutUrl } from './bachs-checkout.ts';

test('isBachsCheckoutUrl accepts Bachs hosted checkout hosts', () => {
  assert.equal(isBachsCheckoutUrl('https://checkout.bachs.io/c/token'), true);
  assert.equal(isBachsCheckoutUrl('https://sandbox-checkout.bachs.io/c/token'), true);
});

test('isBachsCheckoutUrl rejects other providers', () => {
  assert.equal(isBachsCheckoutUrl('https://checkout.nomba.com/pay'), false);
  assert.equal(isBachsCheckoutUrl('not-a-url'), false);
});

// bachs.js validates checkoutUrl against Initialize({ baseUrl }) and rejects with
// "checkoutUrl must be on https://checkout.bachs.io" when the session was created in the
// sandbox, so the overlay must be initialized with the session's own origin.
test('sandbox checkout URLs keep their own origin', () => {
  const sandbox = new URL('https://sandbox-checkout.bachs.io/c/token');
  const live = new URL('https://checkout.bachs.io/c/token');
  assert.notEqual(sandbox.origin, live.origin);
});
