import assert from 'node:assert/strict';
import test from 'node:test';
import { IDLE_LOCK_MS, isIdlePastThreshold } from './idle-lock.ts';

test('idle threshold is eight hours', () => {
  assert.equal(IDLE_LOCK_MS, 8 * 60 * 60 * 1000);
});

test('isIdlePastThreshold compares against last activity', () => {
  const last = 1_000_000;
  assert.equal(isIdlePastThreshold(last + IDLE_LOCK_MS - 1, IDLE_LOCK_MS, last), false);
  assert.equal(isIdlePastThreshold(last + IDLE_LOCK_MS, IDLE_LOCK_MS, last), true);
});
