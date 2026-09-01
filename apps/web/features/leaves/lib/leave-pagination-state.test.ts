import assert from 'node:assert/strict';
import test from 'node:test';
import { clampLeavePage } from './leave-pagination-state.ts';

test('moves back to the last available page after deleting its only item', () => {
  assert.equal(clampLeavePage(2, 1), 1);
});

test('keeps the current page when it remains available', () => {
  assert.equal(clampLeavePage(2, 3), 2);
});
