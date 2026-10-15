import assert from 'node:assert/strict';
import test from 'node:test';
import { isPayrollFundingPending } from './payroll-funding.ts';

test('funding is pending while the float top-up checkout is open', () => {
  assert.equal(isPayrollFundingPending({ floatTopup: { status: 'pending' } }), true);
});

test('funding is not pending once completed, missing, or malformed', () => {
  assert.equal(isPayrollFundingPending({ floatTopup: { status: 'completed' } }), false);
  assert.equal(isPayrollFundingPending({}), false);
  assert.equal(isPayrollFundingPending({ floatTopup: 'pending' }), false);
  assert.equal(isPayrollFundingPending(null), false);
  assert.equal(isPayrollFundingPending(undefined), false);
});
