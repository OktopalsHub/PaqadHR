import assert from 'node:assert/strict';
import test from 'node:test';

import { effectiveStageId, groupByStage, resolveStageDrop } from './stage-board.ts';

const stages = [
  { id: 'a', type: 'APPLIED' },
  { id: 's', type: 'SCREENING' },
  { id: 'custom', type: 'SCREENING' },
  { id: 'i', type: 'INTERVIEW' },
  { id: 'r', type: 'REJECTED' },
];

test('candidates sit in their own stage, including custom stages of the same type', () => {
  const grouped = groupByStage(stages, [
    { id: '1', status: 'SCREENING' as const, stageId: 'custom' },
    { id: '2', status: 'SCREENING' as const, stageId: 's' },
  ]);
  assert.deepEqual(grouped.custom.map((c) => c.id), ['1']);
  assert.deepEqual(grouped.s.map((c) => c.id), ['2']);
});

test('a candidate without a known stage falls back to the first stage of its status', () => {
  assert.equal(effectiveStageId(stages, { id: '1', status: 'SCREENING', stageId: null }), 's');
  assert.equal(effectiveStageId(stages, { id: '1', status: 'INTERVIEW', stageId: 'gone' }), 'i');
});

test('moving between two stages of the same status is allowed', () => {
  const candidate = { id: '1', status: 'SCREENING' as const, stageId: 's' };
  assert.deepEqual(resolveStageDrop(stages, candidate, stages[2]), { type: 'move' });
});

test('dropping on the current stage is a no-op and skipping ahead is invalid', () => {
  const candidate = { id: '1', status: 'APPLIED' as const, stageId: 'a' };
  assert.deepEqual(resolveStageDrop(stages, candidate, stages[0]), { type: 'noop' });
  assert.deepEqual(resolveStageDrop(stages, candidate, stages[3]), { type: 'invalid' });
  assert.deepEqual(resolveStageDrop(stages, candidate, stages[4]), { type: 'move' });
});
