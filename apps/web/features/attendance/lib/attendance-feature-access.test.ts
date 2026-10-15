import assert from 'node:assert/strict';
import test from 'node:test';
import { canAccessAttendanceFeature } from './attendance-feature-access.ts';

test('denied attendance access does not pass the feature gate', () => {
  const canAccess = canAccessAttendanceFeature(
    true,
    (feature) => {
      assert.equal(feature, 'ATTENDANCE');
      return false;
    },
    'ATTENDANCE',
  );

  assert.equal(canAccess, false);
});

test('attendance access stays enabled when gating is disabled', () => {
  const canAccess = canAccessAttendanceFeature(false, () => false, 'ATTENDANCE');

  assert.equal(canAccess, true);
});
