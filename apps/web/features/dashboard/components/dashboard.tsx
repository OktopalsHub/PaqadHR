'use client';

import { ArrowUpRight, Briefcase, Building2, CalendarClock, RefreshCw, Users } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { AppPage } from '@/components/app-page';
import { ContentCard } from '@/components/content-card';
import { LoadingBlock } from '@/components/loading-block';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DashboardActivityFeed } from '@/features/dashboard/components/dashboard-activity-feed';
import { UpcomingReminders } from '@/features/dashboard/components/upcoming-reminders';
import { getDashboardRecruitmentAccessState } from '@/features/dashboard/lib/dashboard-feature-access';
import { RecruitmentApplicantsTable } from '@/features/recruitment/components/dashboard/recruitment-applicants-table';
import { RecruitmentScheduleWidget } from '@/features/recruitment/components/dashboard/recruitment-schedule-widget';
import { RecruitmentVacancyGrid } from '@/features/recruitment/components/dashboard/recruitment-vacancy-grid';
import { JobDetailSheet } from '@/features/recruitment/components/job-detail-sheet';
import { useRecruitmentOverview } from '@/features/recruitment/hooks/use-recruitment-overview';
import { useEmployees } from '@/hooks/queries/use-employees';
import { useFeatureAccess } from '@/hooks/queries/use-feature-access';
import { useLeaves } from '@/hooks/queries/use-leaves';
import { useJobOpenings } from '@/hooks/queries/use-recruitment';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import { isTenantAdmin } from '@/lib/auth/manager-access';
import { FeatureAccess } from '@/lib/constants/feature-access';
import { formatDate } from '@/lib/format-date';
import type { JobOpening } from '@/lib/schemas/recruitment';
import { useTenant } from '@/providers/tenant-provider';

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
  const { tenant } = useTenant();
  const isAdmin = isTenantAdmin(tenant?.member?.role);
  const { hasFeature, featureGatingEnabled } = useFeatureAccess();
  const recruitmentAccess = getDashboardRecruitmentAccessState({
    isAdmin,
    featureGatingEnabled,
    hasFeature,
    recruitmentFeature: FeatureAccess.RECRUITMENT,
  });
  const { canAccessRecruitment, recruitmentQueriesEnabled } = recruitmentAccess;
  const {
    data: employees = [],
    isLoading: employeesLoading,
    isError: employeesError,
    refetch: refetchEmployees,
  } = useEmployees();
  const {
    data: leaves = [],
    isLoading: leavesLoading,
    isError: leavesError,
    refetch: refetchLeaves,
  } = useLeaves();
  const {
    data: jobsData,
    isLoading: jobsLoading,
    isError: jobsError,
  } = useJobOpenings({ enabled: recruitmentQueriesEnabled });
  const {
    overview,
    isLoading: overviewLoading,
    jobsError: overviewError,
    refetch: refetchOverview,
  } = useRecruitmentOverview({ enabled: recruitmentQueriesEnabled });
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const tenantHref = useTenantHref();

  const isLoading =
    employeesLoading ||
    leavesLoading ||
    (isAdmin && canAccessRecruitment && (jobsLoading || overviewLoading));
  const hasError =
    employeesError ||
    leavesError ||
    (isAdmin && canAccessRecruitment && (jobsError || overviewError));

  const jobs = jobsData?.jobs ?? [];
  const openRoles = useMemo(() => jobs.filter((job) => job.status === 'ACTIVE').length, [jobs]);
  const pendingLeaves = useMemo(
    () => leaves.filter((leave) => leave.status?.toLowerCase() === 'pending').length,
    [leaves],
  );
  const recentLeaves = useMemo(
    () =>
      [...leaves]
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
        .slice(0, 6),
    [leaves],
  );
  const departmentCount = useMemo(
    () => new Set(employees.map((employee) => employee.department).filter(Boolean)).size,
    [employees],
  );
  const pipelineStages = useMemo(
    () => [
      { label: 'Active', count: jobs.filter((job) => job.status === 'ACTIVE').length },
      { label: 'Draft', count: jobs.filter((job) => job.status === 'DRAFT').length },
      { label: 'Closed', count: jobs.filter((job) => job.status === 'CLOSED').length },
      { label: 'Archived', count: jobs.filter((job) => job.status === 'ARCHIVED').length },
    ],
    [jobs],
  );
  const pipelineMax = useMemo(
    () => Math.max(1, ...pipelineStages.map((stage) => stage.count)),
    [pipelineStages],
  );
  const contentCardHeaderClassName = 'border-b border-border/60 px-5 py-4';
  const contentCardTitleClassName = 'text-[17px] font-semibold text-foreground';
  const statCards = [
    {
      label: 'Headcount',
      value: employees.length,
      hint: 'Active employees',
      icon: Users,
      iconClassName: 'bg-warning/15 text-warning',
    },
    ...(recruitmentAccess.includeOpenRolesCard
      ? [
          {
            label: 'Open roles',
            value: openRoles,
            hint: `${jobs.length} total postings`,
            icon: Briefcase,
            iconClassName: 'bg-info/15 text-info',
          },
        ]
      : []),
    {
      label: 'Pending leave',
      value: pendingLeaves,
      hint: `${leaves.length} requests total`,
      icon: CalendarClock,
      iconClassName: 'bg-success/15 text-success',
    },
    {
      label: 'Departments',
      value: departmentCount,
      hint: 'With assigned members',
      icon: Building2,
      iconClassName: 'bg-indigo-100 text-indigo-700',
    },
  ] as const;
  const statGridClassName =
    statCards.length === 3
      ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3'
      : 'grid gap-4 md:grid-cols-2 xl:grid-cols-4';

  const handleSelectJobDetails = useCallback((job: JobOpening) => {
    setSelectedJobId(job.id);
  }, []);

  const handleJobDetailOpenChange = useCallback((open: boolean) => {
    if (!open) setSelectedJobId(null);
  }, []);

  if (isLoading) {
    return (
      <AppPage>
        <LoadingBlock />
      </AppPage>
    );
  }

  const retryDashboard = () => {
    void refetchEmployees();
    void refetchLeaves();
    if (recruitmentQueriesEnabled) {
      void refetchOverview();
    }
  };

  return (
    <AppPage className="space-y-6">
      {hasError ? (
        <Alert
          variant="destructive"
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <AlertTitle>Some dashboard data is unavailable</AlertTitle>
            <AlertDescription>
              Your workspace is still available. You can retry the affected data now.
            </AlertDescription>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" onClick={retryDashboard}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Retry
          </Button>
        </Alert>
      ) : null}
      {recruitmentAccess.showRecruitmentCallToAction ? (
        <div className="flex justify-stretch sm:justify-end">
          <Button
            asChild
            variant="brand"
            size="appCta"
            className="w-full normal-case tracking-normal text-sm sm:w-auto"
          >
            <Link href={tenantHref('recruitment')}>
              View Recruitment
              <ArrowUpRight className="ml-1.5 size-3.5" />
            </Link>
          </Button>
        </div>
      ) : null}

      <div className={statGridClassName}>
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="dashboard-panel rounded-[8px] px-5 py-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="dashboard-outline-label text-[11px] font-semibold uppercase">
                    {card.label}
                  </p>
                  <p className="mt-3 text-[31px] font-semibold leading-none tracking-[-0.035em] text-foreground">
                    {card.value}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{card.hint}</p>
                </div>
                <div
                  className={`flex size-11 items-center justify-center rounded-2xl shadow-sm ${card.iconClassName}`}
                >
                  <Icon className="size-4.5" />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <UpcomingReminders />

      <div className="grid gap-4 xl:grid-cols-12">
        <ContentCard
          className={`dashboard-panel rounded-[8px] ${
            recruitmentAccess.showRecruitmentSections ? 'xl:col-span-8' : 'xl:col-span-7'
          }`}
          headerClassName={contentCardHeaderClassName}
          titleClassName={contentCardTitleClassName}
          title="Recent leave requests"
          action={
            <Link href={tenantHref('leaves')} className="dashboard-link text-xs font-semibold">
              View all
            </Link>
          }
          bodyClassName="p-4"
        >
          {leavesError ? (
            <div className="flex min-h-70 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <CalendarClock className="size-10 text-muted-foreground" />
              <p className="text-sm">Leave requests could not be loaded right now.</p>
              <Button variant="outline" size="sm" onClick={() => void refetchLeaves()}>
                Try again
              </Button>
            </div>
          ) : recentLeaves.length === 0 ? (
            <div className="flex min-h-70 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <CalendarClock className="size-10 text-muted-foreground" />
              <p className="text-sm">No leave requests yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentLeaves.map((leave) => (
                <div
                  key={leave.id}
                  className="dashboard-soft-tile flex flex-col gap-3 rounded-[8px] px-4 py-3 transition-colors hover:bg-background/70 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {leave.employee}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {leave.type} · {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
                    </p>
                  </div>
                  <Badge
                    variant={leaveStatusVariant(leave.status ?? 'pending')}
                    className="self-start rounded-full px-2.5 py-1 text-[11px] sm:self-auto"
                  >
                    {leave.status ?? 'Pending'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </ContentCard>

        {recruitmentAccess.showRecruitmentSections ? (
          <ContentCard
            className="dashboard-panel rounded-[8px] xl:col-span-4"
            headerClassName={contentCardHeaderClassName}
            titleClassName={contentCardTitleClassName}
            title="Hiring pipeline"
            action={
              <Link
                href={tenantHref('recruitment')}
                className="dashboard-link text-xs font-semibold"
              >
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
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                    {stage.count}
                  </p>
                </div>
              ))}
            </div>
            <div className="dashboard-soft-tile rounded-[8px] px-3 pb-2 pt-4">
              <div className="flex h-24 items-end gap-2 border-b border-border/60 pb-2">
                {pipelineStages.map((stage) => {
                  const height = Math.max(10, (stage.count / pipelineMax) * 100);
                  return (
                    <div key={stage.label} className="flex flex-1 flex-col items-center gap-2">
                      <div
                        className="dashboard-chart-bar w-full max-w-9"
                        style={{ height: `${height}%` }}
                      ></div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between text-[10px] font-medium text-muted-foreground">
                {pipelineStages.map((stage) => (
                  <span key={stage.label}>{stage.label}</span>
                ))}
              </div>
            </div>
          </ContentCard>
        ) : (
          <div className="min-w-0 xl:col-span-5">
            <DashboardActivityFeed />
          </div>
        )}
      </div>

      {recruitmentAccess.showRecruitmentSections ? (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <RecruitmentVacancyGrid
              jobs={overview.jobs.filter((job) => job.status === 'ACTIVE')}
              applicantCounts={overview.applicantCounts}
              onSelectDetails={handleSelectJobDetails}
            />
            <RecruitmentScheduleWidget events={overview.schedule} />
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <div className="min-w-0 h-full xl:col-span-2">
              <RecruitmentApplicantsTable rows={overview.applicantRows} />
            </div>
            <div className="min-w-0 h-full">
              <DashboardActivityFeed />
            </div>
          </div>

          <JobDetailSheet
            jobId={selectedJobId}
            open={Boolean(selectedJobId)}
            onOpenChange={handleJobDetailOpenChange}
          />
        </>
      ) : null}
    </AppPage>
  );
};
