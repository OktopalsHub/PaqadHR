'use client';

import { Briefcase, Plus } from 'lucide-react';
import { useState } from 'react';
import { AppPage } from '@/components/app-page';
import { ContentCard } from '@/components/content-card';
import { EmptyState } from '@/components/empty-state';
import { LoadingBlock } from '@/components/loading-block';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useRecruitmentOverview } from '../hooks/use-recruitment-overview';
import { CreateJobDialog } from './create-job-dialog';
import { RecruitmentApplicantsTable } from './dashboard/recruitment-applicants-table';
import { RecruitmentApplicationsChart } from './dashboard/recruitment-applications-chart';
import { RecruitmentDepartmentChart } from './dashboard/recruitment-department-chart';
import { RecruitmentKpiRow } from './dashboard/recruitment-kpi-row';
import { RecruitmentSourceChart } from './dashboard/recruitment-source-chart';
import { JobDetailSheet } from './job-detail-sheet';
import { JobOpeningCard } from './job-opening-card';
import { RecruitmentSectionTabs } from './recruitment-section-tabs';
import { ViewCareersPageLink } from './view-careers-page-link';

export function RecruitmentPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
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
          <AlertTitle>Unable to load recruitment</AlertTitle>
          <AlertDescription>
            {jobsErrorObj instanceof Error ? jobsErrorObj.message : 'Something went wrong'}
          </AlertDescription>
        </Alert>
      </AppPage>
    );
  }

  return (
    <AppPage className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <RecruitmentSectionTabs active="roles" />
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
          <ViewCareersPageLink />
          <Button
            variant="brandSolid"
            size="app"
            className="w-full sm:w-max"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-4" />
            New role
          </Button>
        </div>
      </div>

      <RecruitmentKpiRow kpis={overview.kpis} />

      <ContentCard
        title="Open roles"
        description="Manage published positions and review job-level details."
        className="dashboard-panel rounded-[8px]"
        headerClassName="border-b border-[#d7e3f6] px-5 py-4 dark:border-slate-800"
        titleClassName="text-[17px] font-semibold text-slate-950 dark:text-slate-100"
        bodyClassName="p-5"
      >
        {overview.jobs.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No roles yet"
            description="Create your first role to start tracking applications and hiring progress."
            action={
              <Button variant="brandSolid" size="app" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                New role
              </Button>
            }
            className="min-h-[280px] border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/60"
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {overview.jobs.map((job) => (
              <JobOpeningCard
                key={job.id}
                job={job}
                onSelectDetails={(selectedJob) => setSelectedJobId(selectedJob.id)}
              />
            ))}
          </div>
        )}
      </ContentCard>

      <div className="grid gap-5">
        <RecruitmentApplicationsChart data={overview.applicationsChart} />
        <div className="grid gap-5 lg:grid-cols-2">
          <RecruitmentDepartmentChart data={overview.departmentChart} />
          <RecruitmentSourceChart data={overview.sourceChart} />
        </div>
      </div>

      <RecruitmentApplicantsTable rows={overview.applicantRows} />

      <CreateJobDialog open={createOpen} onOpenChange={setCreateOpen} />
      <JobDetailSheet
        jobId={selectedJobId}
        open={selectedJobId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedJobId(null);
        }}
      />
    </AppPage>
  );
}
