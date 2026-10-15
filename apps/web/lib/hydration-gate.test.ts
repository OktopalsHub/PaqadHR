import assert from 'node:assert/strict';
import test from 'node:test';
import { CALENDAR_SHELL_HEIGHT_CLASS, shouldShowHydrationPlaceholder } from './hydration-gate.ts';

test('shouldShowHydrationPlaceholder covers pre-hydrate and loading states', () => {
  assert.equal(shouldShowHydrationPlaceholder(false), true);
  assert.equal(shouldShowHydrationPlaceholder(true), false);
  assert.equal(shouldShowHydrationPlaceholder(true, true), true);
  assert.equal(shouldShowHydrationPlaceholder(false, true), true);
});

test('calendar shell height class stays responsive to avoid loading layout shift', () => {
  assert.match(CALENDAR_SHELL_HEIGHT_CLASS, /min\(72vh,\s*760px\)/);
  assert.match(CALENDAR_SHELL_HEIGHT_CLASS, /min-h-\[520px\]/);
  assert.doesNotMatch(CALENDAR_SHELL_HEIGHT_CLASS, /h-\[38rem\]/);
});
