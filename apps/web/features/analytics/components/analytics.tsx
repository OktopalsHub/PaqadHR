'use client';

import { Briefcase, CalendarClock, Heart, Target, TrendingUp, Users, Wallet } from 'lucide-react';
import { AppPage } from '@/components/app-page';
import { LoadingBlock } from '@/components/loading-block';
import { StatCard } from '@/components/stat-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAnalyticsOverview } from '@/hooks/queries/use-analytics';
import { formatPaqPoints } from '@/lib/constants/paq-points';
import { AnalyticsCharts } from './analytics-charts';

function formatCurrency(amount: number | null, currency: string | null) {
  if (amount == null) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency ?? 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency ?? ''} ${amount.toLocaleString()}`.trim();
  }
}

export const Analytics = () => {
  const { data, isLoading, isError, error } = useAnalyticsOverview();

  if (isLoading) {
    return (
      <AppPage>
        <LoadingBlock />
      </AppPage>
    );
  }

  if (isError || !data) {
    return (
      <AppPage>
        <Alert variant="destructive">
          <AlertTitle>Unable to load analytics</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Something went wrong'}
          </AlertDescription>
        </Alert>
      </AppPage>
    );
  }

  return (
    <AppPage className="space-y-5">
      {/* <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Live workforce, hiring, leave, payroll, and recognition insights.
          </p>
        </div>
        <Badge variant="outline" className="font-normal">
          Updated {formatDate(data.generatedAt)}
        </Badge>
      </div> */}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active employees"
          value={data.workforce.activeEmployees}
          hint={`${data.workforce.totalEmployees} total · ${data.workforce.newHiresLast30Days} new this month`}
          icon={Users}
        />
        <StatCard
          label="Open roles"
          value={data.recruitment.openRoles}
          hint={`${data.recruitment.totalCandidates} candidates · ${data.recruitment.hired} hired`}
          icon={Briefcase}
        />
        <StatCard
          label="Pending leave"
          value={data.leaves.pending}
          hint={`${data.leaves.onLeaveNow} out today`}
          icon={CalendarClock}
        />
        <StatCard
          label="Last payroll"
          value={formatCurrency(data.payroll.lastRunAmount, data.payroll.lastRunCurrency)}
          hint={
            data.payroll.lastRunTitle
              ? data.payroll.lastRunTitle
              : `${data.payroll.completedRuns} completed runs`
          }
          icon={Wallet}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Attendance rate"
          value={
            data.attendance.attendanceRate != null ? `${data.attendance.attendanceRate}%` : '—'
          }
          hint={`Last ${data.attendance.periodDays} days`}
          icon={Target}
        />
        <StatCard
          label="Departments"
          value={data.workforce.departmentCount}
          hint="Organizational units"
          icon={TrendingUp}
        />
        <StatCard
          label="Shoutouts"
          value={data.recognition.shoutoutsThisMonth}
          hint={`${formatPaqPoints(data.recognition.pointsAwardedThisMonth)} this month`}
          icon={Heart}
        />
        <StatCard
          label="Payroll runs"
          value={data.payroll.totalRuns}
          hint={`${data.payroll.completedRuns} completed`}
          icon={Wallet}
          iconClassName="bg-chart-2/15 text-chart-2"
        />
      </div>

      <AnalyticsCharts data={data} />
    </AppPage>
  );
};
