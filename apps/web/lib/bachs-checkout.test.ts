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
