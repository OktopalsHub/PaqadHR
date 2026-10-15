import assert from 'node:assert/strict';
import test from 'node:test';
import { getRecruitmentOverviewQueryOptions } from './recruitment-overview-query-options.ts';

test('calendar querying follows a disabled recruitment overview query option', () => {
  assert.deepEqual(getRecruitmentOverviewQueryOptions(false), { enabled: false });
});

test('recruitment overview queries default to enabled', () => {
  assert.deepEqual(getRecruitmentOverviewQueryOptions(undefined), { enabled: true });
});
