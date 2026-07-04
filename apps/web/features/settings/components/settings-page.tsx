'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { AppPage } from '@/components/app-page';
import { LoadingBlock } from '@/components/loading-block';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SettingsAttendanceTab } from '@/features/settings/components/settings-attendance-tab';
import { SettingsBillingTab } from '@/features/settings/components/settings-billing-tab';
import { SettingsHolidaysTab } from '@/features/settings/components/settings-holidays-tab';
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
import { buildTabUrl } from '@/lib/navigation/tab-query';
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
};

function SettingsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { tenant } = useTenant();

  const role = tenant?.member?.role?.toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin';

  const tabParam = searchParams.get('tab');
  const activeTab: SettingsTab = isSettingsTab(tabParam) ? tabParam : 'profile';

  useEffect(() => {
    if (!isAdmin && ADMIN_SETTINGS_TABS.includes(activeTab)) {
      router.replace(buildTabUrl(pathname, searchParams, 'profile'));
    }
  }, [activeTab, isAdmin, pathname, router, searchParams]);

  const setTab = (tab: SettingsTab) => {
    router.replace(buildTabUrl(pathname, searchParams, tab), { scroll: false });
  };

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
          <TabsList className="inline-flex h-auto min-w-max items-center justify-start gap-1 rounded-[8px] border border-slate-100 bg-white p-1 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] dark:border-slate-800 dark:bg-slate-950/75 dark:shadow-none">
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

        <TabsContent value="profile" className="mt-0">
          <SettingsProfileTab />
        </TabsContent>
        {isAdmin ? (
          <TabsContent value="workspace" className="mt-0">
            <SettingsWorkspaceTab />
          </TabsContent>
        ) : null}
        {isAdmin ? (
          <TabsContent value="leave" className="mt-0">
            <SettingsLeaveTab />
          </TabsContent>
        ) : null}
        {isAdmin ? (
          <TabsContent value="shoutouts" className="mt-0">
            <SettingsShoutoutsTab />
          </TabsContent>
        ) : null}
        {isAdmin ? (
          <TabsContent value="rewards" className="mt-0">
            <SettingsRewardsTab />
          </TabsContent>
        ) : null}
        {isAdmin ? (
          <TabsContent value="holidays" className="mt-0">
            <SettingsHolidaysTab />
          </TabsContent>
        ) : null}
        {isAdmin ? (
          <TabsContent value="notifications" className="mt-0">
            <SettingsNotificationsTab />
          </TabsContent>
        ) : null}
        {isAdmin ? (
          <TabsContent value="attendance" className="mt-0">
            <SettingsAttendanceTab />
          </TabsContent>
        ) : null}
        {isAdmin ? (
          <TabsContent value="billing" className="mt-0">
            <SettingsBillingTab />
          </TabsContent>
        ) : null}
      </Tabs>
    </AppPage>
  );
}

export function SettingsPage() {
  return (
    <Suspense
      fallback={
        <AppPage>
          <LoadingBlock />
        </AppPage>
      }
    >
      <SettingsPageContent />
    </Suspense>
  );
}
