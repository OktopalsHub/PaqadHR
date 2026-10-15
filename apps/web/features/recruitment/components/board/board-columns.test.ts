import assert from 'node:assert/strict';
import test from 'node:test';
import type { BoardColumnId, CandidateStatus } from './board-columns.ts';
import { canReject, columnForStatus, resolveColumnDrop } from './board-columns.ts';

test('every candidate status maps to exactly one board column', () => {
  const statuses: CandidateStatus[] = [
    'APPLIED',
    'SCREENING',
    'UNDER_REVIEW',
    'INTERVIEW',
    'OFFER',
    'HIRED',
    'REJECTED',
    'WITHDRAWN',
  ];

  for (const status of statuses) {
    const columnId = columnForStatus(status);
    assert.ok(columnId, `${status} has no column`);
  }

  assert.equal(columnForStatus('REJECTED'), 'disqualified');
  assert.equal(columnForStatus('WITHDRAWN'), 'disqualified');
  assert.equal(columnForStatus('HIRED'), 'hiring');
});

test('drops within the same column are no-ops instead of downgrades', () => {
  const cases: Array<[CandidateStatus, BoardColumnId]> = [
    ['APPLIED', 'applied'],
    ['SCREENING', 'review'],
    ['UNDER_REVIEW', 'review'],
    ['INTERVIEW', 'interview'],
    ['OFFER', 'hiring'],
    ['HIRED', 'hiring'],
    ['REJECTED', 'disqualified'],
    ['WITHDRAWN', 'disqualified'],
  ];

  for (const [status, columnId] of cases) {
    assert.deepEqual(resolveColumnDrop(status, columnId), { type: 'noop' });
  }
});

test('forward column drops resolve to the first legal status in that column', () => {
  assert.deepEqual(resolveColumnDrop('APPLIED', 'review'), { type: 'move', status: 'SCREENING' });
  assert.deepEqual(resolveColumnDrop('SCREENING', 'interview'), {
    type: 'move',
    status: 'INTERVIEW',
  });
  assert.deepEqual(resolveColumnDrop('UNDER_REVIEW', 'interview'), {
    type: 'move',
    status: 'INTERVIEW',
  });
  assert.deepEqual(resolveColumnDrop('INTERVIEW', 'hiring'), { type: 'move', status: 'OFFER' });
  assert.deepEqual(resolveColumnDrop('APPLIED', 'disqualified'), {
    type: 'move',
    status: 'REJECTED',
  });
});

test('column drops the backend state machine forbids are rejected client-side', () => {
  const cases: Array<[CandidateStatus, BoardColumnId, CandidateStatus]> = [
    ['SCREENING', 'applied', 'APPLIED'],
    ['UNDER_REVIEW', 'applied', 'APPLIED'],
    ['INTERVIEW', 'applied', 'APPLIED'],
    ['INTERVIEW', 'review', 'SCREENING'],
    ['OFFER', 'interview', 'INTERVIEW'],
    ['SCREENING', 'hiring', 'OFFER'],
    ['UNDER_REVIEW', 'hiring', 'OFFER'],
    ['HIRED', 'applied', 'APPLIED'],
    ['HIRED', 'disqualified', 'REJECTED'],
    ['REJECTED', 'interview', 'INTERVIEW'],
  ];

  for (const [status, columnId, expectedStatus] of cases) {
    assert.deepEqual(resolveColumnDrop(status, columnId), {
      type: 'invalid',
      status: expectedStatus,
    });
  }
});

test('only statuses the backend can reject expose a reject action', () => {
  assert.equal(canReject('APPLIED'), true);
  assert.equal(canReject('INTERVIEW'), true);
  assert.equal(canReject('OFFER'), true);
  assert.equal(canReject('HIRED'), false);
  assert.equal(canReject('REJECTED'), false);
  assert.equal(canReject('WITHDRAWN'), false);
});
