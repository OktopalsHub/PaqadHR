import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  toDashboardApplicantRows,
  toPipelineStages,
  toVacancyApplicantCounts,
} from './dashboard-summary-mapper';

test('pipeline stages fold review statuses into screening and tolerate missing ones', () => {
  const stages = toPipelineStages({ APPLIED: 3, SCREENING: 2, UNDER_REVIEW: 1, HIRED: 4 });
  assert.deepEqual(
    stages.map((stage) => [stage.label, stage.count]),
    [
      ['Applied', 3],
      ['Screening', 3],
      ['Interview', 0],
      ['Offer', 0],
      ['Hired', 4],
    ],
  );
});

test('applicant rows fall back when the role or date is missing', () => {
  const [row] = toDashboardApplicantRows([
    {
      id: 'c1',
      firstName: 'Ada',
      lastName: 'Obi',
      email: 'ada@example.com',
      status: 'APPLIED',
      appliedAt: null,
      roleTitle: null,
      employmentType: null,
    },
  ]);
  assert.equal(row.name, 'Ada Obi');
  assert.equal(row.role, 'Unknown role');
  assert.equal(row.date, '');
});

test('vacancy applicant counts are keyed by job id', () => {
  assert.deepEqual(
    toVacancyApplicantCounts([
      { id: 'j1', title: 'A', employmentType: 'FULL_TIME', status: 'ACTIVE', applicantCount: 5 },
    ]),
    { j1: 5 },
  );
});
