'use client';

import { Suspense, useEffect } from 'react';
import { AppPage } from '@/components/app-page';
import { LoadingBlock } from '@/components/loading-block';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SettingsAttendanceTab } from '@/features/settings/components/settings-attendance-tab';
import { SettingsBillingTab } from '@/features/settings/components/settings-billing-tab';
import { SettingsHolidaysTab } from '@/features/settings/components/settings-holidays-tab';
import { SettingsIntegrationsTab } from '@/features/settings/components/settings-integrations-tab';
import { SettingsLeaveTab } from '@/features/settings/components/settings-leave-tab';
import { SettingsNotificationsTab } from '@/features/settings/components/settings-notifications-tab';
import { SettingsProfileTab } from '@/features/settings/components/settings-profile-tab';
import { SettingsRewardsTab } from '@/features/settings/components/settings-rewards-tab';
import { SettingsShoutoutsTab } from '@/features/settings/components/settings-shoutouts-tab';
import { SettingsWorkspaceTab } from '@/features/settings/components/settings-workspace-tab';
import {
  ADMIN_SETTINGS_TABS,
  isSettingsTab,
  type SettingsTab,
} from '@/features/settings/lib/settings-tabs';
import { useUrlTab } from '@/hooks/use-url-tab';
import { useTenant } from '@/providers/tenant-provider';

const TAB_LABELS: Record<SettingsTab, string> = {
  profile: 'Profile',
  workspace: 'Workspace',
  leave: 'Leave',
  shoutouts: 'Shoutouts',
  rewards: 'Rewards',
  holidays: 'Holidays',
  notifications: 'Notifications',
  attendance: 'Attendance',
  billing: 'Billing',
  integrations: 'Integrations',
};

const TAB_PANEL_CLASS = 'mt-0 data-[state=inactive]:hidden';

function TabPanelFallback() {
  return <LoadingBlock />;
}

export function SettingsPage() {
  const { tenant } = useTenant();
  const [activeTab, setTab] = useUrlTab(isSettingsTab, 'profile');

  const role = tenant?.member?.role?.toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin';

  useEffect(() => {
    if (!isAdmin && ADMIN_SETTINGS_TABS.includes(activeTab)) {
      setTab('profile');
    }
  }, [activeTab, isAdmin, setTab]);

  const visibleTab = !isAdmin && ADMIN_SETTINGS_TABS.includes(activeTab) ? 'profile' : activeTab;
  const tabOrder: SettingsTab[] = isAdmin
    ? [
        'profile',
        'workspace',
        'leave',
        'shoutouts',
        'rewards',
        'holidays',
        'notifications',
        'attendance',
        'billing',
        'integrations',
      ]
    : ['profile'];

  return (
    <AppPage className="mx-auto w-full max-w-7xl space-y-6">
      <div className="space-y-1.5">
        <p className="dashboard-outline-label text-[11px] font-semibold uppercase">Workspace</p>
        <h1 className="text-[30px] font-semibold tracking-[-0.035em] text-slate-950 dark:text-slate-50">
          Settings
        </h1>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Manage your account preferences and workspace configuration.
        </p>
      </div>

      <Tabs
        value={visibleTab}
        onValueChange={(value) => setTab(value as SettingsTab)}
        className="space-y-5"
      >
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex h-auto min-w-max flex-nowrap items-center justify-start gap-1 rounded-[8px] border border-slate-100 bg-white p-1 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] dark:border-slate-800 dark:bg-slate-950/75 dark:shadow-none">
            {tabOrder.map((tab) => (
              <TabsTrigger
                key={tab}
                className="!flex-none rounded-[8px] px-5 py-2 text-sm font-medium text-slate-500 transition-colors data-[state=active]:border data-[state=active]:border-slate-200 data-[state=active]:bg-slate-50 data-[state=active]:font-semibold data-[state=active]:text-slate-800 data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:border-slate-700 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-slate-100 dark:data-[state=active]:shadow-none"
                value={tab}
              >
                {TAB_LABELS[tab]}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="profile" forceMount className={TAB_PANEL_CLASS}>
          <SettingsProfileTab />
        </TabsContent>
        {isAdmin ? (
          <TabsContent value="workspace" forceMount className={TAB_PANEL_CLASS}>
            <SettingsWorkspaceTab />
          </TabsContent>
        ) : null}
        {isAdmin ? (
          <TabsContent value="leave" forceMount className={TAB_PANEL_CLASS}>
            <SettingsLeaveTab />
          </TabsContent>
        ) : null}
        {isAdmin ? (
          <TabsContent value="shoutouts" forceMount className={TAB_PANEL_CLASS}>
            <SettingsShoutoutsTab />
          </TabsContent>
        ) : null}
        {isAdmin ? (
          <TabsContent value="rewards" forceMount className={TAB_PANEL_CLASS}>
            <Suspense fallback={<TabPanelFallback />}>
              <SettingsRewardsTab />
            </Suspense>
          </TabsContent>
        ) : null}
        {isAdmin ? (
          <TabsContent value="holidays" forceMount className={TAB_PANEL_CLASS}>
            <SettingsHolidaysTab />
          </TabsContent>
        ) : null}
        {isAdmin ? (
          <TabsContent value="notifications" forceMount className={TAB_PANEL_CLASS}>
            <SettingsNotificationsTab />
          </TabsContent>
        ) : null}
        {isAdmin ? (
          <TabsContent value="attendance" forceMount className={TAB_PANEL_CLASS}>
            <SettingsAttendanceTab />
          </TabsContent>
        ) : null}
        {isAdmin ? (
          <TabsContent value="billing" forceMount className={TAB_PANEL_CLASS}>
            <Suspense fallback={<TabPanelFallback />}>
              <SettingsBillingTab />
            </Suspense>
          </TabsContent>
        ) : null}
        {isAdmin ? (
          <TabsContent value="integrations" forceMount className={TAB_PANEL_CLASS}>
            <Suspense fallback={<TabPanelFallback />}>
              <SettingsIntegrationsTab />
            </Suspense>
          </TabsContent>
        ) : null}
      </Tabs>
    </AppPage>
  );
}
