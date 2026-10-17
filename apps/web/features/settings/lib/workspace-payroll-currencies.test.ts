import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getDefaultPayrollCurrencyForCountry,
  reprioritizePayrollCurrenciesForCountry,
  resolveInitialPayrollCurrencies,
} from './workspace-payroll-currencies.ts';

test('country fallback resolves the expected default payroll currency', () => {
  assert.equal(getDefaultPayrollCurrencyForCountry(null), 'USD');
  assert.equal(getDefaultPayrollCurrencyForCountry('  '), 'USD');
  assert.equal(getDefaultPayrollCurrencyForCountry('NG'), 'NGN');
  assert.equal(getDefaultPayrollCurrencyForCountry('gb'), 'GBP');
  assert.equal(getDefaultPayrollCurrencyForCountry('bg'), 'EUR');
  assert.equal(getDefaultPayrollCurrencyForCountry('DE'), 'EUR');
  assert.equal(getDefaultPayrollCurrencyForCountry('CA'), 'USD');
});

test('initial payroll currencies remove unsupported and duplicate codes', () => {
  assert.deepEqual(
    resolveInitialPayrollCurrencies({
      countryCode: 'NG',
      settingsPayrollCurrencies: ['usd', 'NGN', 'usd', 'kes', 'ngn'],
    }),
    ['USD', 'NGN'],
  );
});

test('saved payroll currencies keep tenant preferred as primary without forcing country default', () => {
  assert.deepEqual(
    resolveInitialPayrollCurrencies({
      countryCode: 'NG',
      settingsPayrollCurrencies: ['USD', 'NGN'],
      tenantPreferredCurrency: 'USD',
    }),
    ['USD', 'NGN'],
  );
});

test('initial payroll currencies fall back to the country default', () => {
  assert.deepEqual(
    resolveInitialPayrollCurrencies({
      countryCode: 'DE',
      tenantPreferredCurrency: 'GBP',
    }),
    ['EUR', 'GBP'],
  );

  assert.deepEqual(
    resolveInitialPayrollCurrencies({
      countryCode: null,
      tenantPreferredCurrency: null,
    }),
    ['USD'],
  );
});

test('an NG workspace ignores a stale preferred currency and defaults to NGN', () => {
  assert.deepEqual(
    resolveInitialPayrollCurrencies({
      countryCode: 'NG',
      tenantPreferredCurrency: 'USD',
    }),
    ['NGN'],
  );
});

test('changing country reprioritizes the new default without losing enabled currencies', () => {
  assert.deepEqual(reprioritizePayrollCurrenciesForCountry(['USD', 'EUR', 'GBP', 'USD'], 'GB'), [
    'GBP',
    'USD',
    'EUR',
  ]);

  assert.deepEqual(reprioritizePayrollCurrenciesForCountry(['NGN', 'USD', 'EUR'], 'CA'), [
    'USD',
    'NGN',
    'EUR',
  ]);
});
