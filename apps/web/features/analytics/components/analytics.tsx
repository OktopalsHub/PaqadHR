'use client';

import { Briefcase, CalendarClock, Heart, Target, TrendingUp, Users, Wallet } from 'lucide-react';
import { AppPage } from '@/components/app-page';
import { LoadingBlock } from '@/components/loading-block';
import { StatCard } from '@/components/stat-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  isUpgradeRequiredError,
  UpgradeRequiredPanel,
} from '@/features/billing/components/upgrade-prompt';
import { useAnalyticsOverview } from '@/hooks/queries/use-analytics';
import { FeatureAccess } from '@/lib/constants/feature-access';
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

  if (isError && isUpgradeRequiredError(error)) {
    return (
      <AppPage className="mx-auto w-full max-w-5xl">
        <UpgradeRequiredPanel feature={FeatureAccess.ADVANCED_REPORTING} />
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
          iconClassName="bg-emerald-500/12 text-emerald-700"
        />
        <StatCard
          label="Open roles"
          value={data.recruitment.openRoles}
          hint={`${data.recruitment.totalCandidates} candidates · ${data.recruitment.hired} hired`}
          icon={Briefcase}
          iconClassName="bg-sky-500/12 text-sky-700"
        />
        <StatCard
          label="Pending leave"
          value={data.leaves.pending}
          hint={`${data.leaves.onLeaveNow} out today`}
          icon={CalendarClock}
          iconClassName="bg-amber-500/14 text-amber-700"
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
          iconClassName="bg-violet-500/12 text-violet-700"
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
          iconClassName="bg-cyan-500/12 text-cyan-700"
        />
        <StatCard
          label="Departments"
          value={data.workforce.departmentCount}
          hint="Organizational units"
          icon={TrendingUp}
          iconClassName="bg-indigo-500/12 text-indigo-700"
        />
        <StatCard
          label="Shoutouts"
          value={data.recognition.shoutoutsThisMonth}
          hint={`${formatPaqPoints(data.recognition.pointsAwardedThisMonth)} this month`}
          icon={Heart}
          iconClassName="bg-rose-500/12 text-rose-700"
        />
        <StatCard
          label="Payroll runs"
          value={data.payroll.totalRuns}
          hint={`${data.payroll.completedRuns} completed`}
          icon={Wallet}
          iconClassName="bg-blue-500/12 text-blue-700"
        />
      </div>

      <AnalyticsCharts data={data} />
    </AppPage>
  );
};
