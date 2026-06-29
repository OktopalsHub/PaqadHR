'use client';

import { ArrowUpRight, Briefcase, CalendarClock, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AppPage } from '@/components/app-page';
import { ContentCard } from '@/components/content-card';
import { LoadingBlock } from '@/components/loading-block';
import { PageActions } from '@/components/page-actions';
import { StatCard } from '@/components/stat-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UpcomingReminders } from '@/features/dashboard/components/upcoming-reminders';
import { RecruitmentActivityFeed } from '@/features/recruitment/components/dashboard/recruitment-activity-feed';
import { RecruitmentApplicantsTable } from '@/features/recruitment/components/dashboard/recruitment-applicants-table';
import { RecruitmentScheduleWidget } from '@/features/recruitment/components/dashboard/recruitment-schedule-widget';
import { RecruitmentVacancyGrid } from '@/features/recruitment/components/dashboard/recruitment-vacancy-grid';
import { JobDetailSheet } from '@/features/recruitment/components/job-detail-sheet';
import { useRecruitmentOverview } from '@/features/recruitment/hooks/use-recruitment-overview';
import { useEmployees } from '@/hooks/queries/use-employees';
import { useLeaves } from '@/hooks/queries/use-leaves';
import { useJobOpenings } from '@/hooks/queries/use-recruitment';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import { formatDate } from '@/lib/format-date';
import type { JobOpening } from '@/lib/schemas/recruitment';

function leaveStatusVariant(status: string) {
  switch (status.toLowerCase()) {
    case 'approved':
      return 'default';
    case 'pending':
      return 'secondary';
    case 'rejected':
      return 'destructive';
    default:
      return 'outline';
  }
}

export const Dashboard = () => {
  const {
    data: employees = [],
    isLoading: employeesLoading,
    isError: employeesError,
  } = useEmployees();
  const { data: leaves = [], isLoading: leavesLoading, isError: leavesError } = useLeaves();
  const { data: jobsData, isLoading: jobsLoading, isError: jobsError } = useJobOpenings();
  const {
    overview,
    isLoading: overviewLoading,
    jobsError: overviewError,
  } = useRecruitmentOverview();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const tenantHref = useTenantHref();

  const isLoading = employeesLoading || leavesLoading || jobsLoading || overviewLoading;
  const hasError = employeesError || leavesError || jobsError || overviewError;

  const jobs = jobsData?.jobs ?? [];
  const openRoles = jobs.filter((job) => job.status === 'ACTIVE').length;
  const pendingLeaves = leaves.filter((leave) => leave.status?.toLowerCase() === 'pending').length;
  const recentLeaves = [...leaves]
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    .slice(0, 6);

  const departmentCount = new Set(employees.map((employee) => employee.department).filter(Boolean))
    .size;

  const pipelineStages = [
    { label: 'Active', count: jobs.filter((job) => job.status === 'ACTIVE').length },
    { label: 'Draft', count: jobs.filter((job) => job.status === 'DRAFT').length },
    { label: 'Closed', count: jobs.filter((job) => job.status === 'CLOSED').length },
    { label: 'Archived', count: jobs.filter((job) => job.status === 'ARCHIVED').length },
  ];
  const pipelineMax = Math.max(1, ...pipelineStages.map((stage) => stage.count));

  const handleSelectJobDetails = (job: JobOpening) => {
    setSelectedJobId(job.id);
  };

  if (isLoading) {
    return (
      <AppPage>
        <LoadingBlock />
      </AppPage>
    );
  }

  if (hasError) {
    return (
      <AppPage>
        <Alert variant="destructive">
          <AlertTitle>Unable to load dashboard</AlertTitle>
          <AlertDescription>
            Some workspace data could not be loaded. Refresh the page or try again shortly.
          </AlertDescription>
        </Alert>
      </AppPage>
    );
  }

  return (
    <AppPage className="space-y-5">
      <PageActions>
        <Button asChild size="sm" className="h-8 rounded-lg text-xs">
          <Link href={tenantHref('recruitment')}>
            View recruitment
            <ArrowUpRight className="ml-1.5 size-3.5" />
          </Link>
        </Button>
      </PageActions>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Headcount" value={employees.length} hint="Active employees" icon={Users} />
        <StatCard
          label="Open roles"
          value={openRoles}
          hint={`${jobs.length} total postings`}
          icon={Briefcase}
        />
        <StatCard
          label="Pending leave"
          value={pendingLeaves}
          hint={`${leaves.length} requests total`}
          icon={CalendarClock}
        />
        <StatCard
          label="Departments"
          value={departmentCount || '—'}
          hint="With assigned members"
          icon={Users}
          iconClassName="bg-chart-2/15 text-chart-2"
        />
      </div>

      <UpcomingReminders />

      <div className="grid gap-4 xl:grid-cols-12">
        <ContentCard
          className="xl:col-span-8"
          title="Recent leave requests"
          action={
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
              <Link href={tenantHref('leaves')}>View all</Link>
            </Button>
          }
          bodyClassName="p-0"
        >
          {recentLeaves.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No leave requests yet.
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {recentLeaves.map((leave) => (
                <div
                  key={leave.id}
                  className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/30"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{leave.employee}</p>
                    <p className="text-xs text-muted-foreground">
                      {leave.type} · {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
                    </p>
                  </div>
                  <Badge variant={leaveStatusVariant(leave.status ?? 'pending')}>
                    {leave.status ?? 'Pending'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </ContentCard>

        <ContentCard
          className="xl:col-span-4"
          title="Hiring pipeline"
          action={
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
              <Link href={tenantHref('recruitment')}>Manage</Link>
            </Button>
          }
          bodyClassName="p-4"
        >
          <div className="grid grid-cols-2 gap-3">
            {pipelineStages.map((stage) => (
              <div
                key={stage.label}
                className="rounded-lg border border-border/60 bg-muted/20 px-3 py-3"
              >
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {stage.label}
                </p>
                <p className="mt-1 text-xl font-semibold">{stage.count}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex h-20 items-end gap-2 border-b border-border/60 pb-1">
            {pipelineStages.map((stage) => {
              const height = Math.max(8, (stage.count / pipelineMax) * 100);
              return (
                <div key={stage.label} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full max-w-8 rounded-t-md bg-primary/70"
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground">{stage.label}</span>
                </div>
              );
            })}
          </div>
        </ContentCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <RecruitmentVacancyGrid
          jobs={overview.jobs.filter((job) => job.status === 'ACTIVE')}
          applicantCounts={overview.applicantCounts}
          onSelectDetails={handleSelectJobDetails}
        />
        <RecruitmentScheduleWidget events={overview.schedule} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <RecruitmentApplicantsTable rows={overview.applicantRows} />
        <RecruitmentActivityFeed items={[...overview.activity]} />
      </div>

      <JobDetailSheet
        jobId={selectedJobId}
        open={Boolean(selectedJobId)}
        onOpenChange={(open) => {
          if (!open) setSelectedJobId(null);
        }}
      />
    </AppPage>
  );
};
