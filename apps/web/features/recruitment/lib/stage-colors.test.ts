import assert from 'node:assert/strict';
import test from 'node:test';

import { stageColor, statusColor } from './stage-colors';

test('a chosen stage color wins over the type default', () => {
  assert.equal(stageColor({ color: '#ec4899', type: 'APPLIED' }), '#ec4899');
});

test('stages without a color fall back to their type color', () => {
  assert.equal(stageColor({ color: null, type: 'HIRED' }), statusColor('HIRED'));
  assert.equal(stageColor({ type: 'UNKNOWN' }), '#64748b');
});
