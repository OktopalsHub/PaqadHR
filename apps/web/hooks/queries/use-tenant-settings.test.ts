import assert from 'node:assert/strict';
import test from 'node:test';
import { queryKeys } from '@/lib/query/keys';
import {
  paymentMethodCurrenciesQueryKey,
  shouldInvalidatePaymentMethodCurrencies,
} from './tenant-settings-invalidation.ts';

test('cryptoEnabled alone invalidates payment currencies', () => {
  assert.equal(shouldInvalidatePaymentMethodCurrencies({ general: { cryptoEnabled: true } }), true);
});

test('payrollCurrencies alone invalidates payment currencies', () => {
  assert.equal(
    shouldInvalidatePaymentMethodCurrencies({
      general: { payrollCurrencies: ['NGN', 'USD'] },
    }),
    true,
  );
});

test('unrelated settings do not invalidate payment currencies', () => {
  assert.equal(
    shouldInvalidatePaymentMethodCurrencies({
      attendance: { weekends: [0, 6], clockInEnabled: true },
    }),
    false,
  );
  assert.equal(shouldInvalidatePaymentMethodCurrencies({}), false);
  assert.equal(shouldInvalidatePaymentMethodCurrencies({ general: {} }), false);
});

test('payment currency query key is tenant-scoped', () => {
  const tenantId = 'tenant-abc';
  assert.deepEqual(paymentMethodCurrenciesQueryKey(tenantId), [
    ...queryKeys.paymentMethods.currencies,
    tenantId,
  ]);
});
