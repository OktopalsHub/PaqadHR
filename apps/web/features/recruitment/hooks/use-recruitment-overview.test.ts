import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useRecruitmentOverview } from './use-recruitment-overview.ts';

function renderUseRecruitmentOverview(
  options?: Parameters<typeof useRecruitmentOverview>[0],
  dependencies?: Parameters<typeof useRecruitmentOverview>[1],
) {
  let result: ReturnType<typeof useRecruitmentOverview> | undefined;

  function TestComponent() {
    result = useRecruitmentOverview(options, dependencies);
    return createElement('div');
  }

  renderToStaticMarkup(createElement(TestComponent));
  assert.ok(result);
  return result;
}

test('disabled recruitment overview propagates disabled query options to every dependency', () => {
  const calls: Array<[string, string | { enabled?: boolean } | undefined]> = [];
  const error = new Error('Recruitment should stay disabled');

  const result = renderUseRecruitmentOverview(
    { enabled: false },
    {
      useJobOpenings: (options) => {
        calls.push(['jobs', options ?? {}]);
        return {
          data: {
            jobs: [
              {
                id: 'job-1',
                title: 'Designer',
                status: 'ACTIVE',
              },
            ],
          },
          isLoading: true,
          isError: true,
          error,
        } as never;
      },
      useAllCandidates: (options) => {
        calls.push(['candidates', options ?? {}]);
        return {
          data: [
            {
              id: 'candidate-1',
              jobOpeningId: 'job-1',
              firstName: 'Ada',
              lastName: 'Lovelace',
              email: 'ada@example.com',
              status: 'APPLIED',
            },
          ],
          isLoading: true,
        } as never;
      },
      useCalendarEvents: (options) => {
        calls.push(['calendar', options ?? {}]);
        return {
          data: [
            {
              id: 'event-1',
              title: 'Interview',
              date: '2026-07-30',
              type: 'interview',
            },
          ],
        } as never;
      },
    },
  );

  assert.deepEqual(calls, [
    ['jobs', { enabled: false }],
    ['candidates', { enabled: false }],
    ['calendar', { enabled: false }],
  ]);
  assert.equal(result.isLoading, false);
  assert.equal(result.jobsError, false);
  assert.equal(result.jobsErrorObj, error);
  assert.equal(result.overview.kpis.applications, 0);
  assert.deepEqual(result.overview.jobs, []);
  assert.deepEqual(result.overview.applicantCounts, {});
  assert.deepEqual(result.overview.applicantRows, []);
  assert.deepEqual(result.overview.schedule, []);
  assert.deepEqual(result.overview.activity, []);
});
