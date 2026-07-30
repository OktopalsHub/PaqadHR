import { useMemo } from 'react';
import { useCalendarEvents } from '@/hooks/queries/use-calendar';
import { useAllCandidates, useJobOpenings } from '@/hooks/queries/use-recruitment';
import {
  computeApplicationsChart,
  computeDepartmentChart,
  computeRecruitmentKpis,
  computeSourceChart,
  countApplicantsByJob,
  toApplicantRows,
} from '../lib/recruitment-dashboard-metrics';
import { calendarEventsToSchedule } from '../lib/recruitment-schedule-utils';
import { getRecruitmentOverviewQueryOptions } from './recruitment-overview-query-options';

type RecruitmentOverviewDependencies = {
  useAllCandidates: typeof useAllCandidates;
  useCalendarEvents: typeof useCalendarEvents;
  useJobOpenings: typeof useJobOpenings;
};

const defaultRecruitmentOverviewDependencies: RecruitmentOverviewDependencies = {
  useJobOpenings,
  useAllCandidates,
  useCalendarEvents,
};

export function useRecruitmentOverview(
  options?: { enabled?: boolean },
  dependencies: RecruitmentOverviewDependencies = defaultRecruitmentOverviewDependencies,
) {
  const queryOptions = getRecruitmentOverviewQueryOptions(options?.enabled);
  const { enabled } = queryOptions;
  const {
    data: jobsData,
    isLoading: jobsLoading,
    isError: jobsError,
    error: jobsErrorObj,
  } = dependencies.useJobOpenings(queryOptions);
  const { data: apiCandidates = [], isLoading: candidatesLoading } =
    dependencies.useAllCandidates(queryOptions);
  const { data: calendarEvents = [] } = dependencies.useCalendarEvents(queryOptions);

  const apiJobs = jobsData?.jobs ?? [];
  const isLoading = enabled && (jobsLoading || candidatesLoading);

  const overview = useMemo(() => {
    if (!enabled) {
      return {
        kpis: computeRecruitmentKpis([]),
        applicationsChart: computeApplicationsChart([]),
        departmentChart: computeDepartmentChart([], []),
        sourceChart: computeSourceChart([]),
        jobs: [],
        applicantCounts: countApplicantsByJob([]),
        applicantRows: toApplicantRows([], []),
        schedule: [],
        activity: [] as const,
      };
    }
    const jobs = apiJobs;
    return {
      kpis: computeRecruitmentKpis(apiCandidates),
      applicationsChart: computeApplicationsChart(apiCandidates),
      departmentChart: computeDepartmentChart(apiCandidates, jobs),
      sourceChart: computeSourceChart(apiCandidates),
      jobs,
      applicantCounts: countApplicantsByJob(apiCandidates),
      applicantRows: toApplicantRows(apiCandidates, jobs),
      schedule: calendarEventsToSchedule(calendarEvents),
      activity: [] as const,
    };
  }, [apiCandidates, apiJobs, calendarEvents, enabled]);

  return {
    overview,
    isLoading,
    jobsError: enabled ? jobsError : false,
    jobsErrorObj,
  };
}
