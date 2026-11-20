'use client';

import dynamic from 'next/dynamic';

import { AppPage } from '@/components/app-page';
import { LoadingBlock } from '@/components/loading-block';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

import { useRecruitmentOverview } from '../hooks/use-recruitment-overview';
import { RecruitmentApplicantsTable } from './dashboard/recruitment-applicants-table';
import { RecruitmentKpiRow } from './dashboard/recruitment-kpi-row';
import { RecruitmentSectionTabs } from './recruitment-section-tabs';

const chartLoading = () => <Skeleton className="h-72 w-full rounded-xl" />;
const RecruitmentApplicationsChart = dynamic(
  () =>
    import('./dashboard/recruitment-applications-chart').then(
      (m) => m.RecruitmentApplicationsChart,
    ),
  { loading: chartLoading },
);
const RecruitmentDepartmentChart = dynamic(
  () =>
    import('./dashboard/recruitment-department-chart').then((m) => m.RecruitmentDepartmentChart),
  { loading: chartLoading },
);
const RecruitmentSourceChart = dynamic(
  () => import('./dashboard/recruitment-source-chart').then((m) => m.RecruitmentSourceChart),
  { loading: chartLoading },
);

export function RecruitmentAnalyticsPage() {
  const { overview, isLoading, jobsError, jobsErrorObj } = useRecruitmentOverview();

  if (isLoading) {
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
          <AlertTitle>Unable to load recruitment analytics</AlertTitle>
          <AlertDescription>
            {jobsErrorObj instanceof Error ? jobsErrorObj.message : 'Something went wrong'}
          </AlertDescription>
        </Alert>
      </AppPage>
    );
  }

  return (
    <AppPage className="space-y-6">
      <RecruitmentSectionTabs active="analytics" />

      <RecruitmentKpiRow kpis={overview.kpis} />

      <div className="grid gap-5">
        <RecruitmentApplicationsChart data={overview.applicationsChart} />
        <div className="grid gap-5 lg:grid-cols-2">
          <RecruitmentDepartmentChart data={overview.departmentChart} />
          <RecruitmentSourceChart data={overview.sourceChart} total={overview.kpis.applications} />
        </div>
      </div>

      <RecruitmentApplicantsTable rows={overview.applicantRows} />
    </AppPage>
  );
}
