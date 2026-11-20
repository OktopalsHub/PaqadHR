import assert from 'node:assert/strict';
import test from 'node:test';

import { canReject, canTransition, isDisqualified } from './board-columns.ts';

test('rejection is possible until a candidate is hired or already out', () => {
  assert.equal(canReject('APPLIED'), true);
  assert.equal(canReject('OFFER'), true);
  assert.equal(canReject('HIRED'), false);
  assert.equal(canReject('REJECTED'), false);
});

test('statuses only move forward through the pipeline', () => {
  assert.equal(canTransition('APPLIED', 'SCREENING'), true);
  assert.equal(canTransition('APPLIED', 'INTERVIEW'), false);
  assert.equal(canTransition('REJECTED', 'APPLIED'), false);
});

test('rejected and withdrawn candidates are disqualified', () => {
  assert.equal(isDisqualified('REJECTED'), true);
  assert.equal(isDisqualified('WITHDRAWN'), true);
  assert.equal(isDisqualified('INTERVIEW'), false);
});
