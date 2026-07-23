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

export function useRecruitmentOverview(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const {
    data: jobsData,
    isLoading: jobsLoading,
    isError: jobsError,
    error: jobsErrorObj,
  } = useJobOpenings({ enabled });
  const { data: apiCandidates = [], isLoading: candidatesLoading } = useAllCandidates({
    enabled,
  });
  const { data: calendarEvents = [] } = useCalendarEvents();

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
