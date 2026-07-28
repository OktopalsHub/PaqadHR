'use client';

import { Briefcase, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AppPage } from '@/components/app-page';
import { EmptyState } from '@/components/empty-state';
import { LoadingBlock } from '@/components/loading-block';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useRecruitmentOverview } from '../hooks/use-recruitment-overview';
import { RecruitmentBoardToolbar } from './board/recruitment-board-toolbar';
import { CreateJobDialog } from './create-job-dialog';
import { JobDetailSheet } from './job-detail-sheet';
import { JobOpeningCard } from './job-opening-card';
import { RecruitmentSectionTabs } from './recruitment-section-tabs';
import { ViewCareersPageLink } from './view-careers-page-link';

export function RecruitmentPage() {
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const { overview, isLoading, jobsError, jobsErrorObj } = useRecruitmentOverview();

  const filteredJobs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return overview.jobs;

    return overview.jobs.filter((job) => {
      const haystack = [
        job.title,
        job.departmentName,
        job.position,
        job.employmentType,
        job.location?.type,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [overview.jobs, search]);

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:flex-nowrap lg:justify-end">
          <ViewCareersPageLink />
          <Button
            variant="brandSolid"
            size="appCta"
            className="w-full normal-case tracking-normal text-sm sm:w-max"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-4" />
            New role
          </Button>
        </div>
      </div>

      <RecruitmentBoardToolbar
        title="Roles"
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search roles..."
        showCounters={false}
        viewToggle={null}
      />

      {overview.jobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No roles yet"
          action={
            <Button variant="brandSolid" size="app" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              New role
            </Button>
          }
          className="min-h-[280px] border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/60"
        />
      ) : filteredJobs.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching roles"
          description="Try a different search term to find roles."
          className="min-h-[280px] border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/60"
        />
      ) : (
        <section className="dashboard-panel rounded-[8px] p-5">
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredJobs.map((job) => (
              <JobOpeningCard
                key={job.id}
                job={job}
                onSelectDetails={(selectedJob) => setSelectedJobId(selectedJob.id)}
              />
            ))}
          </div>
        </section>
      )}

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
