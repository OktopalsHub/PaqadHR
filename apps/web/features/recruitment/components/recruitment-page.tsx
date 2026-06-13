"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AppPage } from "@/components/app-page";
import { LoadingBlock } from "@/components/loading-block";
import { PageActions } from "@/components/page-actions";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useCalendarEvents } from "@/hooks/queries/use-calendar";
import {
  useAllCandidates,
  useJobOpenings,
} from "@/hooks/queries/use-recruitment";
import type { JobOpening } from "@/lib/schemas/recruitment";
import { RecruitmentKpiRow } from "./dashboard/recruitment-kpi-row";
import { RecruitmentApplicationsChart } from "./dashboard/recruitment-applications-chart";
import { RecruitmentDepartmentChart } from "./dashboard/recruitment-department-chart";
import { RecruitmentSourceChart } from "./dashboard/recruitment-source-chart";
import { RecruitmentVacancyGrid } from "./dashboard/recruitment-vacancy-grid";
import { RecruitmentScheduleWidget } from "./dashboard/recruitment-schedule-widget";
import { RecruitmentApplicantsTable } from "./dashboard/recruitment-applicants-table";
import { RecruitmentActivityFeed } from "./dashboard/recruitment-activity-feed";
import { CreateJobDialog } from "./create-job-dialog";
import { JobDetailSheet } from "./job-detail-sheet";
import {
  computeApplicationsChart,
  computeDepartmentChart,
  computeRecruitmentKpis,
  computeSourceChart,
  countApplicantsByJob,
  toApplicantRows,
} from "../lib/recruitment-dashboard-metrics";
import {
  DEMO_ACTIVITY,
  DEMO_APPLICATIONS_CHART,
  DEMO_DEPARTMENT_CHART,
  DEMO_JOBS,
  DEMO_KPIS,
  DEMO_SCHEDULE,
  DEMO_SOURCE_CHART,
  demoApplicantCounts,
  demoCandidatesForDashboard,
} from "../lib/recruitment-demo-dashboard";
import { calendarEventsToSchedule } from "../lib/recruitment-schedule-utils";

export function RecruitmentPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

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
  const isPreview = apiCandidates.length === 0;

  const dashboard = useMemo(() => {
    if (isPreview) {
      const demoCandidates = demoCandidatesForDashboard();
      return {
        kpis: DEMO_KPIS,
        applicationsChart: DEMO_APPLICATIONS_CHART,
        departmentChart: DEMO_DEPARTMENT_CHART,
        sourceChart: DEMO_SOURCE_CHART,
        jobs: apiJobs.length > 0 ? apiJobs : DEMO_JOBS,
        applicantCounts: demoApplicantCounts(),
        applicantRows: toApplicantRows(
          demoCandidates,
          apiJobs.length > 0 ? apiJobs : DEMO_JOBS,
        ),
        schedule: DEMO_SCHEDULE,
        activity: DEMO_ACTIVITY,
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
      activity: [] as typeof DEMO_ACTIVITY,
    };
  }, [isPreview, apiCandidates, apiJobs, calendarEvents]);

  const handleSelectJobDetails = (job: JobOpening) => {
    setSelectedJobId(job.id);
  };

  if (jobsLoading || candidatesLoading) {
    return (
      <AppPage>
        <LoadingBlock />
      </AppPage>
    );
  }

  if (jobsError) {
    return (
      <AppPage>
        <Alert variant="destructive">
          <AlertTitle>Unable to load recruitment</AlertTitle>
          <AlertDescription>
            {jobsErrorObj instanceof Error
              ? jobsErrorObj.message
              : "Something went wrong"}
          </AlertDescription>
        </Alert>
      </AppPage>
    );
  }

  return (
    <AppPage className="space-y-5">
      <PageActions>
        <Button
          size="sm"
          className="h-8 rounded-lg text-xs"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="mr-1.5 size-3.5" />
          New role
        </Button>
      </PageActions>

      {isPreview ? (
        <Alert className="border-border/60 bg-muted/30">
          <AlertTitle className="text-sm">Preview metrics</AlertTitle>
          <AlertDescription className="text-xs">
            No applications yet. Showing sample KPIs, charts, schedule, and
            activity — real data replaces this automatically.
            {dashboard.jobs.length === 0 ? (
              <>
                {" "}
                <Link
                  href="/app/recruitment/preview"
                  className="font-medium text-primary hover:underline"
                >
                  View sample board
                </Link>
              </>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <RecruitmentKpiRow kpis={dashboard.kpis} />

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecruitmentApplicationsChart data={dashboard.applicationsChart} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
          <RecruitmentDepartmentChart data={dashboard.departmentChart} />
          <RecruitmentSourceChart data={dashboard.sourceChart} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <RecruitmentVacancyGrid
          jobs={dashboard.jobs.filter((j) => j.status === "ACTIVE")}
          applicantCounts={dashboard.applicantCounts}
          onSelectDetails={handleSelectJobDetails}
        />
        <RecruitmentScheduleWidget events={dashboard.schedule} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <RecruitmentApplicantsTable rows={dashboard.applicantRows} />
        <RecruitmentActivityFeed
          items={dashboard.activity}
          isPreview={isPreview}
        />
      </div>

      <CreateJobDialog open={createOpen} onOpenChange={setCreateOpen} />

      <JobDetailSheet
        jobId={selectedJobId}
        open={Boolean(selectedJobId)}
        onOpenChange={(open) => {
          if (!open) setSelectedJobId(null);
        }}
      />
    </AppPage>
  );
}
