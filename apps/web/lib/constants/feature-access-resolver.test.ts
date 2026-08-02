import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasPlanFeatureAccess,
  hasPlanFeaturesAccess,
} from './feature-access-resolver';

test('entitlement parity: payroll is denied when the key is absent', () => {
  assert.equal(hasPlanFeatureAccess({ BASIC_HR: true }, 'PAYROLL'), false);
});

test('entitlement parity: explicit false denies feature access', () => {
  assert.equal(hasPlanFeatureAccess({ PAYROLL: false }, 'PAYROLL'), false);
});

test('entitlement parity: explicit true grants feature access', () => {
  assert.equal(hasPlanFeatureAccess({ PAYROLL: true }, 'PAYROLL'), true);
});

test('entitlement parity: every requested feature must be explicitly true', () => {
  assert.equal(
    hasPlanFeaturesAccess(
      {
        PAYROLL: true,
        LEAVE_MANAGEMENT: true,
      },
      ['PAYROLL', 'LEAVE_MANAGEMENT'],
    ),
    true,
  );
  assert.equal(
    hasPlanFeaturesAccess(
      {
        PAYROLL: true,
      },
      ['PAYROLL', 'LEAVE_MANAGEMENT'],
    ),
    false,
  );
});
