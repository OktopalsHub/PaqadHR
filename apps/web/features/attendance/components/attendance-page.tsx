'use client';

import { Suspense, useState } from 'react';
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
  const [activeTab, setActiveTab] = useState('mine');

  if (isLoading && clockInEnabled) {
    return (
      <AppPage>
        <LoadingBlock />
      </AppPage>
    );
  }

  return (
    <AppPage className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full gap-5">
        <div className="overflow-x-auto pb-1">
          <TabsList className="app-segmented-control">
            <TabsTrigger value="mine" className="app-segmented-trigger sm:px-6">
              My timesheet
            </TabsTrigger>
            {canViewTeam ? (
              <TabsTrigger value="team" className="app-segmented-trigger sm:px-6">
                Team
              </TabsTrigger>
            ) : null}
            <TabsTrigger value="exceptions" className="app-segmented-trigger sm:px-6">
              Exceptions
            </TabsTrigger>
            {isAdmin ? (
              <TabsTrigger value="reports" className="app-segmented-trigger sm:px-6">
                Reports
              </TabsTrigger>
            ) : null}
          </TabsList>
        </div>

        <TabsContent value="mine" className="mt-0">
          <Suspense fallback={<LoadingBlock />}>
            <AttendanceMyTab />
          </Suspense>
        </TabsContent>

        {canViewTeam ? (
          <TabsContent value="team" className="mt-0">
            <Suspense fallback={<LoadingBlock />}>
              <AttendanceTeamTab />
            </Suspense>
          </TabsContent>
        ) : null}

        <TabsContent value="exceptions" className="mt-0">
          <Suspense fallback={<LoadingBlock />}>
            <AttendanceExceptionsTab />
          </Suspense>
        </TabsContent>

        {isAdmin ? (
          <TabsContent value="reports" className="mt-0">
            <Suspense fallback={<LoadingBlock />}>
              <AttendanceReportsTab />
            </Suspense>
          </TabsContent>
        ) : null}
      </Tabs>
    </AppPage>
  );
}
