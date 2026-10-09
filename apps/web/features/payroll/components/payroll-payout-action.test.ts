import assert from 'node:assert/strict';
import test from 'node:test';
import { payrollRowAction } from './payroll-payout-action.ts';

const admin = { isAdmin: true, payrollGatewayEnabled: true };
const gatewayOff = { isAdmin: true, payrollGatewayEnabled: false };

// Regression: Bachs payouts stay `processing` until a webhook confirms them, so the run
// remains `approved`. A status-only check kept rendering "Pay employees" on a run with
// nothing left to pay, and clicking it failed with "No employees could be paid".
test('hides Pay employees once every item is in flight', () => {
  const action = payrollRowAction(
    { status: 'approved', payoutMode: 'immediate', itemCounts: { processing: 3 } },
    admin,
  );
  assert.deepEqual(action, { kind: 'none', note: 'Payment in progress' });
});

test('hides Pay employees once every item is paid', () => {
  const action = payrollRowAction(
    { status: 'approved', payoutMode: 'immediate', itemCounts: { paid: 3 } },
    admin,
  );
  assert.deepEqual(action, { kind: 'none', note: 'Paid' });
});

// Regression: pending and processing are both 0, so a naive check claimed "Paid" on a run
// where every employee was cancelled and nobody received anything.
test('does not claim Paid when everyone was cancelled', () => {
  const action = payrollRowAction(
    { status: 'approved', payoutMode: 'immediate', itemCounts: { cancelled: 3 } },
    admin,
  );
  assert.deepEqual(action, { kind: 'none', note: null });
});

test('does not claim Paid when the run has no items at all', () => {
  const action = payrollRowAction(
    { status: 'approved', payoutMode: 'immediate', itemCounts: {} },
    admin,
  );
  assert.deepEqual(action, { kind: 'none', note: null });
});

test('still says Paid when a cancelled run also had a successful payment', () => {
  const action = payrollRowAction(
    { status: 'approved', payoutMode: 'immediate', itemCounts: { paid: 1, cancelled: 2 } },
    admin,
  );
  assert.deepEqual(action, { kind: 'none', note: 'Paid' });
});

test('offers Retry payment when an approved run has failures and nothing pending', () => {
  const action = payrollRowAction(
    { status: 'approved', payoutMode: 'immediate', itemCounts: { paid: 2, failed: 1 } },
    admin,
  );
  assert.deepEqual(action, { kind: 'retry' });
});

test('still offers Pay employees while items are pending', () => {
  const action = payrollRowAction(
    { status: 'approved', payoutMode: 'immediate', itemCounts: { pending: 2 } },
    admin,
  );
  assert.deepEqual(action, { kind: 'fund-and-pay', label: 'Pay employees' });
});

test('offers Pay employees when some items are pending and some are in flight', () => {
  const action = payrollRowAction(
    { status: 'approved', payoutMode: 'scheduled', itemCounts: { pending: 1, processing: 2 } },
    admin,
  );
  assert.deepEqual(action, { kind: 'fund-and-pay', label: 'Pay now instead' });
});

test('falls back to status-only behaviour when item counts are unavailable', () => {
  const action = payrollRowAction({ status: 'approved', payoutMode: 'immediate' }, admin);
  assert.deepEqual(action, { kind: 'fund-and-pay', label: 'Pay employees' });
});

test('keeps Mark paid when the payout gateway is disabled', () => {
  assert.deepEqual(
    payrollRowAction(
      { status: 'approved', payoutMode: 'immediate', itemCounts: { pending: 1 } },
      gatewayOff,
    ),
    { kind: 'disburse' },
  );
});

test('gives non-admins no action', () => {
  assert.deepEqual(
    payrollRowAction(
      { status: 'approved', payoutMode: 'immediate', itemCounts: { pending: 1 } },
      { isAdmin: false, payrollGatewayEnabled: true },
    ),
    { kind: 'none', note: null },
  );
});

test('leaves draft, processing and completed runs alone', () => {
  assert.deepEqual(payrollRowAction({ status: 'draft' }, admin), { kind: 'calculate' });
  assert.deepEqual(payrollRowAction({ status: 'processing' }, admin), { kind: 'approve' });
  assert.deepEqual(payrollRowAction({ status: 'completed' }, admin), { kind: 'none', note: null });
});
