'use client';

import { AppPage } from '@/components/app-page';
import { LoadingBlock } from '@/components/loading-block';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useRecruitmentOverview } from '../hooks/use-recruitment-overview';
import { RecruitmentApplicantsTable } from './dashboard/recruitment-applicants-table';
import { RecruitmentApplicationsChart } from './dashboard/recruitment-applications-chart';
import { RecruitmentDepartmentChart } from './dashboard/recruitment-department-chart';
import { RecruitmentKpiRow } from './dashboard/recruitment-kpi-row';
import { RecruitmentSourceChart } from './dashboard/recruitment-source-chart';
import { RecruitmentSectionTabs } from './recruitment-section-tabs';

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
