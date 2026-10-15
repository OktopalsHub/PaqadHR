import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearBreadcrumbTailForPathname,
  EMPTY_BREADCRUMB_TAIL_STATE,
  getBreadcrumbTailLabelForPathname,
  setBreadcrumbTailForPathname,
} from './breadcrumb-tail-state.ts';

test('route transitions keep the newest breadcrumb tail label when the previous route cleans up later', () => {
  const currentState = setBreadcrumbTailForPathname('/pikolob/settings', 'Settings');
  const nextState = setBreadcrumbTailForPathname('/pikolob/employees/employee-1', 'Jane Doe');
  const stateAfterOldCleanup = clearBreadcrumbTailForPathname(nextState, currentState.pathname!);

  assert.equal(
    getBreadcrumbTailLabelForPathname(stateAfterOldCleanup, '/pikolob/employees/employee-1'),
    'Jane Doe',
  );
});

test('cleanup clears the tail when the active route unmounts without a replacement label', () => {
  const currentState = setBreadcrumbTailForPathname('/pikolob/settings', 'Settings');
  const clearedState = clearBreadcrumbTailForPathname(currentState, '/pikolob/settings');

  assert.deepEqual(clearedState, EMPTY_BREADCRUMB_TAIL_STATE);
});

test('tail labels are only visible for the matching pathname', () => {
  const currentState = setBreadcrumbTailForPathname('/pikolob/settings', 'Billing');

  assert.equal(getBreadcrumbTailLabelForPathname(currentState, '/pikolob/settings'), 'Billing');
  assert.equal(getBreadcrumbTailLabelForPathname(currentState, '/pikolob/employees'), null);
});
