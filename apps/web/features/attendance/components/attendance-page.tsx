'use client';

import { AppPage } from '@/components/app-page';
import { LoadingBlock } from '@/components/loading-block';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AttendanceMyTab } from '@/features/attendance/components/attendance-my-tab';
import { AttendanceTeamTab } from '@/features/attendance/components/attendance-team-tab';
import { useElapsedSince } from '@/features/attendance/hooks/use-elapsed-since';
import { formatTimeOnly } from '@/features/attendance/lib/attendance-utils';
import { useClockInInfo } from '@/hooks/queries/use-attendance';
import { useEmployees } from '@/hooks/queries/use-employees';
import { useClockInEnabled } from '@/hooks/queries/use-tenant-settings';
import { hasDirectReports, isTenantAdmin } from '@/lib/auth/manager-access';
import { useTenant } from '@/providers/tenant-provider';

export function AttendancePage() {
  const { tenant } = useTenant();
  const role = tenant?.member?.role;
  const viewerMemberId = tenant?.member?.id;
  const { data: employees = [] } = useEmployees();
  const isAdmin = isTenantAdmin(role);
  const canViewTeam =
    isAdmin || (viewerMemberId ? hasDirectReports(viewerMemberId, employees) : false);
  const { enabled: clockInEnabled } = useClockInEnabled();
  const { data: clockInfo, isLoading } = useClockInInfo();
  const elapsed = useElapsedSince(clockInfo?.activeSession?.clockIn);

  if (isLoading && clockInEnabled) {
    return (
      <AppPage>
        <LoadingBlock />
      </AppPage>
    );
  }

  return (
    <AppPage>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
        <p className="text-sm text-muted-foreground">
          {canViewTeam
            ? 'Review your timesheet or browse attendance for your team'
            : 'Filter and review your clock entries'}
        </p>
        {clockInEnabled && clockInfo ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {clockInfo.activeSession ? (
              <>
                On the clock for{' '}
                <span className="font-medium tabular-nums text-green-700 dark:text-green-400">
                  {elapsed || '—'}
                </span>{' '}
                (since {formatTimeOnly(clockInfo.activeSession.clockIn)})
              </>
            ) : clockInfo.canClockIn ? (
              'Off the clock — use the green Clock in button in the header'
            ) : (
              clockInfo.reason
            )}
          </p>
        ) : null}
      </div>

      <Tabs defaultValue="mine" className="w-full">
        <TabsList>
          <TabsTrigger value="mine">My timesheet</TabsTrigger>
          {canViewTeam ? <TabsTrigger value="team">Team</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="mine" className="mt-5">
          <AttendanceMyTab />
        </TabsContent>

        {canViewTeam ? (
          <TabsContent value="team" className="mt-5">
            <AttendanceTeamTab />
          </TabsContent>
        ) : null}
      </Tabs>
    </AppPage>
  );
}
