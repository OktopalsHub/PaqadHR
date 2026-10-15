import assert from 'node:assert/strict';
import test from 'node:test';
import type { SearchableRecruitmentJob } from './filter-recruitment-jobs.ts';
import { filterRecruitmentJobs } from './filter-recruitment-jobs.ts';

const jobs: SearchableRecruitmentJob[] = [
  {
    title: 'Senior Designer',
    departmentName: 'Product',
    position: 'Design Lead',
    employmentType: 'Full Time',
    location: { type: 'REMOTE' },
  },
  {
    title: 'Backend Engineer',
    departmentName: 'Engineering',
    position: 'Platform Engineer',
    employmentType: 'Contract',
  },
];

test('returns the original list when search is empty or whitespace', () => {
  assert.equal(filterRecruitmentJobs(jobs, '').length, 2);
  assert.equal(filterRecruitmentJobs(jobs, '   ').length, 2);
});

test('matches partial terms case-insensitively across multiple job fields', () => {
  assert.deepEqual(
    filterRecruitmentJobs(jobs, 'design').map((job) => job.title),
    ['Senior Designer'],
  );
  assert.deepEqual(
    filterRecruitmentJobs(jobs, 'engi').map((job) => job.title),
    ['Backend Engineer'],
  );
  assert.deepEqual(
    filterRecruitmentJobs(jobs, 'remote').map((job) => job.title),
    ['Senior Designer'],
  );
});

test('handles missing optional location fields without throwing', () => {
  assert.doesNotThrow(() => filterRecruitmentJobs(jobs, 'contract'));
  assert.deepEqual(
    filterRecruitmentJobs(jobs, 'contract').map((job) => job.title),
    ['Backend Engineer'],
  );
});
