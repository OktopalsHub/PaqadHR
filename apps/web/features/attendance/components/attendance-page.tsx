'use client';

import { AppPage } from '@/components/app-page';
import { LoadingBlock } from '@/components/loading-block';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AttendanceExceptionsTab } from '@/features/attendance/components/attendance-exceptions-tab';
import { AttendanceMyTab } from '@/features/attendance/components/attendance-my-tab';
import { AttendanceReportsTab } from '@/features/attendance/components/attendance-reports-tab';
import { AttendanceTeamTab } from '@/features/attendance/components/attendance-team-tab';
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
  const { isLoading } = useClockInInfo();

  if (isLoading && clockInEnabled) {
    return (
      <AppPage>
        <LoadingBlock />
      </AppPage>
    );
  }

  return (
    <AppPage className="mx-auto w-full max-w-7xl space-y-6">
      <Tabs defaultValue="mine" className="w-full gap-5">
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex h-auto min-w-max flex-nowrap items-center rounded-[8px] border border-slate-100 bg-white p-1 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] dark:border-slate-800 dark:bg-slate-950/75 dark:shadow-none">
            <TabsTrigger
              value="mine"
              className="rounded-[8px] px-5 py-2 text-sm font-medium whitespace-nowrap text-slate-500 shadow-none data-[state=active]:border data-[state=active]:border-slate-200 data-[state=active]:bg-slate-50 data-[state=active]:font-semibold data-[state=active]:text-slate-800 data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:border-slate-700 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-slate-100 dark:data-[state=active]:shadow-none sm:px-6"
            >
              My timesheet
            </TabsTrigger>
            {canViewTeam ? (
              <TabsTrigger
                value="team"
                className="rounded-[8px] px-5 py-2 text-sm font-medium whitespace-nowrap text-slate-500 shadow-none data-[state=active]:border data-[state=active]:border-slate-200 data-[state=active]:bg-slate-50 data-[state=active]:font-semibold data-[state=active]:text-slate-800 data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:border-slate-700 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-slate-100 dark:data-[state=active]:shadow-none sm:px-6"
              >
                Team
              </TabsTrigger>
            ) : null}
            <TabsTrigger
              value="exceptions"
              className="rounded-[8px] px-5 py-2 text-sm font-medium whitespace-nowrap text-slate-500 shadow-none data-[state=active]:border data-[state=active]:border-slate-200 data-[state=active]:bg-slate-50 data-[state=active]:font-semibold data-[state=active]:text-slate-800 data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:border-slate-700 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-slate-100 dark:data-[state=active]:shadow-none sm:px-6"
            >
              Exceptions
            </TabsTrigger>
            {isAdmin ? (
              <TabsTrigger
                value="reports"
                className="rounded-[8px] px-5 py-2 text-sm font-medium whitespace-nowrap text-slate-500 shadow-none data-[state=active]:border data-[state=active]:border-slate-200 data-[state=active]:bg-slate-50 data-[state=active]:font-semibold data-[state=active]:text-slate-800 data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:border-slate-700 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-slate-100 dark:data-[state=active]:shadow-none sm:px-6"
              >
                Reports
              </TabsTrigger>
            ) : null}
          </TabsList>
        </div>

        <TabsContent value="mine" className="mt-0">
          <AttendanceMyTab />
        </TabsContent>

        {canViewTeam ? (
          <TabsContent value="team" className="mt-0">
            <AttendanceTeamTab />
          </TabsContent>
        ) : null}

        <TabsContent value="exceptions" className="mt-0">
          <AttendanceExceptionsTab />
        </TabsContent>

        {isAdmin ? (
          <TabsContent value="reports" className="mt-0">
            <AttendanceReportsTab />
          </TabsContent>
        ) : null}
      </Tabs>
    </AppPage>
  );
}
