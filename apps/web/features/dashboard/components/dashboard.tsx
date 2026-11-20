'use client';

import {
  Briefcase,
  CalendarClock,
  ClipboardCheck,
  Clock,
  Gift,
  type LucideIcon,
  Palmtree,
  RefreshCw,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';

import { AppPage } from '@/components/app-page';
import { ContentCard } from '@/components/content-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardActivityFeed } from '@/features/dashboard/components/dashboard-activity-feed';
import { UpcomingReminders } from '@/features/dashboard/components/upcoming-reminders';
import { getDashboardRecruitmentAccessState } from '@/features/dashboard/lib/dashboard-feature-access';
import {
  buildDashboardKpis,
  type DashboardKpi,
  type DashboardKpiIcon,
  resolveDashboardRole,
} from '@/features/dashboard/lib/dashboard-kpis';
import { RecruitmentApplicantsTable } from '@/features/recruitment/components/dashboard/recruitment-applicants-table';
import { RecruitmentScheduleWidget } from '@/features/recruitment/components/dashboard/recruitment-schedule-widget';
import { RecruitmentVacancyGrid } from '@/features/recruitment/components/dashboard/recruitment-vacancy-grid';
import { JobDetailSheet } from '@/features/recruitment/components/job-detail-sheet';
import { useRecruitmentOverview } from '@/features/recruitment/hooks/use-recruitment-overview';
import { useAttendanceStats, useClockInInfo } from '@/hooks/queries/use-attendance';
import { useEmployees, useEmployeeSummary } from '@/hooks/queries/use-employees';
import { useFeatureAccess } from '@/hooks/queries/use-feature-access';
import { useLeaveBalances, useLeaves } from '@/hooks/queries/use-leaves';
import { usePayrollSetupSummary } from '@/hooks/queries/use-payroll';
import { useJobOpenings } from '@/hooks/queries/use-recruitment';
import { useMyPointsBalance } from '@/hooks/queries/use-shoutouts';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import { isTenantAdmin } from '@/lib/auth/manager-access';
import { FeatureAccess } from '@/lib/constants/feature-access';
import { formatDate } from '@/lib/format-date';
import type { JobOpening } from '@/lib/schemas/recruitment';
import { useTenant } from '@/providers/tenant-provider';

const KPI_ICONS: Record<DashboardKpiIcon, LucideIcon> = {
  users: Users,
  userCheck: UserCheck,
  calendarClock: CalendarClock,
  clipboardCheck: ClipboardCheck,
  wallet: Wallet,
  briefcase: Briefcase,
  clock: Clock,
  gift: Gift,
  palmtree: Palmtree,
};

const KPI_TONES: Record<DashboardKpi['tone'], string> = {
  warning: 'bg-warning/15 text-warning',
  success: 'bg-success/15 text-success',
  info: 'bg-info/15 text-info',
  indigo: 'bg-indigo-100 text-indigo-700',
};

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatClockTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

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
  const { data: employees = [] } = useEmployees();
  const memberId = tenant?.member?.id;
  const directReports = memberId
    ? employees.filter((employee) => employee.reportsToId === memberId).length
    : 0;
  const role = resolveDashboardRole(isAdmin, directReports);
  const attendanceEnabled = isAdmin && hasFeature(FeatureAccess.ATTENDANCE);
  const payrollEnabled = isAdmin && hasFeature(FeatureAccess.PAYROLL);
  const attendanceStatsQuery = useAttendanceStats(todayKey(), todayKey(), {
    enabled: attendanceEnabled,
  });
  const payrollSetupQuery = usePayrollSetupSummary(payrollEnabled);
  const leaveBalancesQuery = useLeaveBalances({ enabled: !isAdmin });
  const clockInQuery = useClockInInfo({ enabled: role === 'member' });
  const pointsQuery = useMyPointsBalance({ enabled: !isAdmin });
  const {
    data: employeeSummary,
    isError: employeesError,
    refetch: refetchEmployeeSummary,
  } = useEmployeeSummary();
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
        .slice(0, 5),
    [leaves],
  );
  const departmentCount = useMemo(() => employeeSummary?.departments ?? 0, [employeeSummary]);
  const pipelineStages = useMemo(() => {
    const stages = [
      { label: 'Applied', statuses: ['APPLIED'] },
      { label: 'Screening', statuses: ['SCREENING', 'UNDER_REVIEW'] },
      { label: 'Interview', statuses: ['INTERVIEW'] },
      { label: 'Offer', statuses: ['OFFER'] },
      { label: 'Hired', statuses: ['HIRED'] },
    ];
    return stages.map((stage) => ({
      label: stage.label,
      count: overview.applicantRows.filter((row) => stage.statuses.includes(row.status)).length,
    }));
  }, [overview.applicantRows]);
  const pipelineMax = useMemo(
    () => Math.max(1, ...pipelineStages.map((stage) => stage.count)),
    [pipelineStages],
  );
  const contentCardHeaderClassName = 'border-b border-border/60 px-5 py-4';
  const contentCardTitleClassName = 'text-[17px] font-semibold text-foreground';
  const activeCandidates = useMemo(
    () =>
      overview.applicantRows.filter(
        (row) => !['HIRED', 'REJECTED', 'WITHDRAWN'].includes(row.status),
      ).length,
    [overview.applicantRows],
  );
  const statCards = buildDashboardKpis({
    role,
    today: todayKey(),
    leaves,
    leavesLoading,
    employeeSummary,
    teamSize: directReports,
    attendanceStats: attendanceEnabled
      ? attendanceStatsQuery.isError
        ? null
        : attendanceStatsQuery.data
      : null,
    payrollSetup: payrollEnabled && !payrollSetupQuery.isError ? payrollSetupQuery.data : null,
    openRoles: recruitmentAccess.includeOpenRolesCard
      ? { count: openRoles, activeCandidates, loading: jobsLoading || overviewLoading }
      : null,
    leaveBalances: leaveBalancesQuery.data,
    clockIn: clockInQuery.data
      ? {
          status: clockInQuery.data.status,
          isOnLeave: clockInQuery.data.isOnLeave,
          clockedInAt: clockInQuery.data.activeSession?.clockIn
            ? formatClockTime(clockInQuery.data.activeSession.clockIn)
            : null,
        }
      : null,
    points: pointsQuery.data ?? null,
  });
  const statGridClassName =
    statCards.length >= 5
      ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-5'
      : statCards.length === 3
        ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3'
        : 'grid gap-4 md:grid-cols-2 xl:grid-cols-4';

  const handleSelectJobDetails = useCallback((job: JobOpening) => {
    setSelectedJobId(job.id);
  }, []);

  const handleJobDetailOpenChange = useCallback((open: boolean) => {
    if (!open) setSelectedJobId(null);
  }, []);

  const retryDashboard = () => {
    void refetchEmployeeSummary();
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
            <AlertTitle>Couldn’t load some data</AlertTitle>
            <AlertDescription>Retry the failed sections.</AlertDescription>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" onClick={retryDashboard}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Retry
          </Button>
        </Alert>
      ) : null}

      <div className={statGridClassName}>
        {statCards.map((card) => {
          const Icon = KPI_ICONS[card.icon];
          const body = (
            <article className="dashboard-panel h-full rounded-[8px] px-5 py-5 transition-colors hover:bg-background/60">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="dashboard-outline-label text-[11px] font-semibold uppercase">
                    {card.label}
                  </p>
                  <p className="mt-3 truncate text-[31px] font-semibold leading-none tracking-[-0.035em] text-foreground">
                    {card.value}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{card.hint}</p>
                </div>
                <div
                  className={`flex size-11 shrink-0 items-center justify-center rounded-2xl shadow-sm ${KPI_TONES[card.tone]}`}
                >
                  <Icon className="size-4.5" />
                </div>
              </div>
            </article>
          );
          return card.href ? (
            <Link key={card.key} href={tenantHref(card.href)} className="block">
              {body}
            </Link>
          ) : (
            <div key={card.key}>{body}</div>
          );
        })}
      </div>

      <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
        <UpcomingReminders />

        <ContentCard
          className="dashboard-panel h-full rounded-[8px]"

          headerClassName={contentCardHeaderClassName}
          titleClassName={contentCardTitleClassName}
          title={
            role === 'admin'
              ? 'Recent leave requests'
              : role === 'manager'
                ? 'Team leave requests'
                : 'My leave requests'
          }
          action={
            <Link href={tenantHref('leaves')} className="dashboard-link text-xs font-semibold">
              View all
            </Link>
          }
          bodyClassName="p-4"
        >
          {leavesLoading ? (
            <div className="space-y-3 py-1">
              {['first', 'second', 'third'].map((placeholder) => (
                <div
                  key={placeholder}
                  className="dashboard-soft-tile flex items-center justify-between gap-3 rounded-[8px] px-4 py-3"
                >
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-44" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : leavesError ? (
            <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <CalendarClock className="size-10 text-muted-foreground" />
              <p className="text-sm">Leave requests could not be loaded right now.</p>
              <Button variant="outline" size="sm" onClick={() => void refetchLeaves()}>
                Try again
              </Button>
            </div>
          ) : recentLeaves.length === 0 ? (
            <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
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
            className="dashboard-panel h-full rounded-[8px]"
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
            <ul className="space-y-3">
              {pipelineStages.map((stage) => (
                <li key={stage.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{stage.label}</span>
                    <span className="font-semibold text-foreground">{stage.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="dashboard-chart-bar h-full rounded-full"
                      style={{ width: `${(stage.count / pipelineMax) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              {openRoles} open {openRoles === 1 ? 'role' : 'roles'} ·{' '}
              {overview.applicantRows.length}{' '}
              {overview.applicantRows.length === 1 ? 'candidate' : 'candidates'} in total
            </p>
          </ContentCard>
        ) : (
          <div className="min-w-0">
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
