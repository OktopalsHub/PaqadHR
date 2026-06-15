import { useMemo } from "react";
import { useCalendarEvents } from "@/hooks/queries/use-calendar";
import {
  useAllCandidates,
  useJobOpenings,
} from "@/hooks/queries/use-recruitment";
import {
  computeApplicationsChart,
  computeDepartmentChart,
  computeRecruitmentKpis,
  computeSourceChart,
  countApplicantsByJob,
  toApplicantRows,
} from "../lib/recruitment-dashboard-metrics";
import { calendarEventsToSchedule } from "../lib/recruitment-schedule-utils";

export function useRecruitmentOverview() {
  const {
    data: jobsData,
    isLoading: jobsLoading,
    isError: jobsError,
    error: jobsErrorObj,
  } = useJobOpenings();
  const {
    data: apiCandidates = [],
    isLoading: candidatesLoading,
  } = useAllCandidates();
  const { data: calendarEvents = [] } = useCalendarEvents();

  const apiJobs = jobsData?.jobs ?? [];
  const isLoading = jobsLoading || candidatesLoading;

  const overview = useMemo(() => {
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
  }, [apiCandidates, apiJobs, calendarEvents]);

  return {
    overview,
    isLoading,
    jobsError,
    jobsErrorObj,
  };
}
