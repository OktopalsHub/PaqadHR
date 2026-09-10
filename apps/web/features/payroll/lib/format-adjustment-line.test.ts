import assert from 'node:assert/strict';
import { adjustmentTypeLabel, formatAdjustmentLineLabel } from './format-adjustment-line';

assert.equal(adjustmentTypeLabel('bonus'), 'Bonus');
assert.equal(
  formatAdjustmentLineLabel(
    { type: 'bonus', method: 'fixed_amount', value: 5000, reason: 'Q3 performance' },
    'NGN',
  ),
  'Bonus · NGN 5,000 · Q3 performance',
);
assert.equal(
  formatAdjustmentLineLabel({ type: 'bonus', method: 'percentage', value: 10 }, 'USD'),
  'Bonus · 10%',
);

console.log('format-adjustment-line: ok');
