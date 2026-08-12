import assert from 'node:assert/strict';
import test from 'node:test';
import { formatPlanMoney } from './format-plan-money.ts';

test('formats NGN without fractional digits', () => {
  const formatted = formatPlanMoney(1000, 'NGN');
  assert.match(formatted, /1,?000/);
  assert.doesNotMatch(formatted, /\.00/);
});

test('formats USD with cents when present', () => {
  const formatted = formatPlanMoney(10.5, 'USD');
  assert.match(formatted, /10\.50/);
});
