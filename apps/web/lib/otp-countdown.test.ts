import assert from 'node:assert/strict';
import test from 'node:test';
import { formatOtpCountdown, getRemainingOtpSeconds } from './otp-countdown';

test('formats and clamps the OTP countdown', () => {
  assert.equal(formatOtpCountdown(600), '10:00');
  assert.equal(formatOtpCountdown(9), '0:09');
  assert.equal(getRemainingOtpSeconds(10_001, 1), 10);
  assert.equal(getRemainingOtpSeconds(1, 2), 0);
});
