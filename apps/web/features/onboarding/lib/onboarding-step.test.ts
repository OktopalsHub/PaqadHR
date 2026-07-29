import assert from 'node:assert/strict';
import test from 'node:test';
import { clampOnboardingStep } from './onboarding-step.ts';

test('clamps onboarding steps below zero and above the last step', () => {
  assert.equal(clampOnboardingStep(-1, 4), 0);
  assert.equal(clampOnboardingStep(99, 4), 3);
});

test('normalizes non-integer and non-finite onboarding step values safely', () => {
  assert.equal(clampOnboardingStep(2.9, 4), 2);
  assert.equal(clampOnboardingStep(Number.NaN, 4), 0);
});
