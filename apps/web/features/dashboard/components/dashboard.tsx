'use client';

import { ArrowUpRight, Briefcase, Building2, CalendarClock, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AppPage } from '@/components/app-page';
import { ContentCard } from '@/components/content-card';
import { LoadingBlock } from '@/components/loading-block';
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
  const statCards = [
    {
      label: 'Headcount',
      value: employees.length,
      hint: 'Active employees',
      icon: Users,
      iconClassName: 'bg-[#ffddb8] text-[#653e00]',
    },
    {
      label: 'Open roles',
      value: openRoles,
      hint: `${jobs.length} total postings`,
      icon: Briefcase,
      iconClassName: 'bg-[#d8e2ff] text-[#004395]',
    },
    {
      label: 'Pending leave',
      value: pendingLeaves,
      hint: `${leaves.length} requests total`,
      icon: CalendarClock,
      iconClassName: 'bg-[#ffe9cf] text-[#855300]',
    },
    {
      label: 'Departments',
      value: departmentCount || '—',
      hint: 'With assigned members',
      icon: Building2,
      iconClassName: 'bg-[#e1ebff] text-[#35598e]',
    },
  ] as const;

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
    <AppPage className="space-y-6">
      <div className="flex justify-end">
        <Button asChild variant="brand" size="appCta">
          <Link href={tenantHref('recruitment')}>
            View recruitment
            <ArrowUpRight className="ml-1.5 size-3.5" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="dashboard-panel rounded-[8px] px-5 py-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="dashboard-outline-label text-[11px] font-semibold uppercase">
                    {card.label}
                  </p>
                  <p className="mt-3 text-[31px] font-semibold leading-none tracking-[-0.035em] text-slate-950">
                    {card.value}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">{card.hint}</p>
                </div>
                <div
                  className={`flex size-11 items-center justify-center rounded-2xl shadow-sm ${card.iconClassName}`}
                >
                  <Icon className="size-[18px]" />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <UpcomingReminders />

      <div className="grid gap-4 xl:grid-cols-12">
        <ContentCard
          className="dashboard-panel rounded-[8px] xl:col-span-8"
          headerClassName="border-b border-[#d7e3f6] px-5 py-4"
          titleClassName="text-[17px] font-semibold text-slate-950"
          title="Recent leave requests"
          action={
            <Link href={tenantHref('leaves')} className="dashboard-link text-xs font-semibold">
              View all
            </Link>
          }
          bodyClassName="p-4"
        >
          {recentLeaves.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-center text-slate-500">
              <CalendarClock className="size-10 text-slate-400" />
              <p className="text-sm">No leave requests yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentLeaves.map((leave) => (
                <div
                  key={leave.id}
                  className="dashboard-soft-tile rounded-[8px] flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-white/80"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {leave.employee}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {leave.type} · {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
                    </p>
                  </div>
                  <Badge
                    variant={leaveStatusVariant(leave.status ?? 'pending')}
                    className="rounded-full px-2.5 py-1 text-[11px]"
                  >
                    {leave.status ?? 'Pending'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </ContentCard>

        <ContentCard
          className="dashboard-panel rounded-[8px] xl:col-span-4"
          headerClassName="border-b border-[#d7e3f6] px-5 py-4"
          titleClassName="text-[17px] font-semibold text-slate-950"
          title="Hiring pipeline"
          action={
            <Link href={tenantHref('recruitment')} className="dashboard-link text-xs font-semibold">
              Manage
            </Link>
          }
          bodyClassName="space-y-4 p-4"
        >
          <div className="grid grid-cols-2 gap-3">
            {pipelineStages.map((stage) => (
              <div key={stage.label} className="dashboard-soft-tile rounded-[8px] px-3 py-3">
                <p className="dashboard-outline-label text-[10px] font-semibold uppercase">
                  {stage.label}
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                  {stage.count}
                </p>
              </div>
            ))}
          </div>
          <div className="rounded-[8px] border border-[#d7e3f6] bg-white/55 px-3 pb-2 pt-4">
            <div className="flex h-24 items-end gap-2 border-b border-[#d7e3f6] pb-2">
              {pipelineStages.map((stage) => {
                const height = Math.max(10, (stage.count / pipelineMax) * 100);
                return (
                  <div key={stage.label} className="flex flex-1 flex-col items-center gap-2">
                    <div
                      className="w-full max-w-9 rounded-t-xl bg-gradient-to-t from-[#334e7e] to-[#7da7ef]"
                      style={{ height: `${height}%` }}
                    ></div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-[10px] font-medium text-slate-500">
              {pipelineStages.map((stage) => (
                <span key={stage.label}>{stage.label}</span>
              ))}
            </div>
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

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="h-full xl:col-span-2">
          <RecruitmentApplicantsTable rows={overview.applicantRows} />
        </div>
        <div className="h-full">
          <RecruitmentActivityFeed items={[...overview.activity]} />
        </div>
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
