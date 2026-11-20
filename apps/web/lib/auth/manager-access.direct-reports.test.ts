import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveViewerDirectReportsCount } from './manager-access.ts';

test('uses the session count and ignores the member list when present', () => {
  const list = [{ reportsToId: 'm1' }, { reportsToId: 'm1' }];
  assert.equal(resolveViewerDirectReportsCount({ id: 'm1', directReportsCount: 0 }, list), 0);
  assert.equal(resolveViewerDirectReportsCount({ id: 'm1', directReportsCount: 3 }, undefined), 3);
});

test('falls back to the member list for older payloads', () => {
  const list = [{ reportsToId: 'm1' }, { reportsToId: 'm2' }, { reportsToId: 'm1' }];
  assert.equal(resolveViewerDirectReportsCount({ id: 'm1' }, list), 2);
  assert.equal(resolveViewerDirectReportsCount({ id: 'm1' }, undefined), 0);
  assert.equal(resolveViewerDirectReportsCount(undefined, list), 0);
});
