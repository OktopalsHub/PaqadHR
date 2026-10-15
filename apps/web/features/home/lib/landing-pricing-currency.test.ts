import assert from 'node:assert/strict';
import test from 'node:test';
import { createLandingPricingCurrencyController } from './landing-pricing-currency.ts';

test('resolved landing pricing updates currency while the CTA is still mounted', () => {
  const updates: string[] = [];
  const controller = createLandingPricingCurrencyController((currency) => {
    updates.push(currency);
  });

  controller.applyResolvedCurrency({ currency: 'NGN' });

  assert.deepEqual(updates, ['NGN']);
});

test('resolved landing pricing does not update currency after the CTA unmounts', () => {
  const updates: string[] = [];
  const controller = createLandingPricingCurrencyController((currency) => {
    updates.push(currency);
  });

  controller.cleanup();
  controller.applyResolvedCurrency({ currency: 'EUR' });

  assert.deepEqual(updates, []);
});

test('fallback currency does not update after the CTA unmounts', () => {
  const updates: string[] = [];
  const controller = createLandingPricingCurrencyController((currency) => {
    updates.push(currency);
  });

  controller.cleanup();
  controller.applyFallbackCurrency();

  assert.deepEqual(updates, []);
});
