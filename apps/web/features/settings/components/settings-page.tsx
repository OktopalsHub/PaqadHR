'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { AppPage } from '@/components/app-page';
import { LoadingBlock } from '@/components/loading-block';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SettingsBillingTab } from '@/features/settings/components/settings-billing-tab';
import { SettingsHolidaysTab } from '@/features/settings/components/settings-holidays-tab';
import { SettingsLeaveTab } from '@/features/settings/components/settings-leave-tab';
import { SettingsNotificationsTab } from '@/features/settings/components/settings-notifications-tab';
import { SettingsAttendanceTab } from '@/features/settings/components/settings-attendance-tab';
import { SettingsProfileTab } from '@/features/settings/components/settings-profile-tab';
import { SettingsRewardsTab } from '@/features/settings/components/settings-rewards-tab';
import { SettingsShoutoutsTab } from '@/features/settings/components/settings-shoutouts-tab';
import { SettingsWorkspaceTab } from '@/features/settings/components/settings-workspace-tab';
import {
  ADMIN_SETTINGS_TABS,
  type SettingsTab,
  isSettingsTab,
} from '@/features/settings/lib/settings-tabs';
import { buildTabUrl } from '@/lib/navigation/tab-query';
import { useTenant } from '@/providers/tenant-provider';

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

  return (
    <AppPage className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and workspace</p>
      </div>

      <Tabs value={visibleTab} onValueChange={(value) => setTab(value as SettingsTab)}>
        <TabsList className="h-auto w-full justify-start flex-wrap gap-1.5 p-1.5 bg-muted/60">
          <TabsTrigger className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-4 h-auto" value="profile">Profile</TabsTrigger>
          {isAdmin ? <TabsTrigger className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-4 h-auto" value="workspace">Workspace</TabsTrigger> : null}
          {isAdmin ? <TabsTrigger className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-4 h-auto" value="leave">Leave</TabsTrigger> : null}
          {isAdmin ? <TabsTrigger className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-4 h-auto" value="shoutouts">Shoutouts</TabsTrigger> : null}
          {isAdmin ? <TabsTrigger className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-4 h-auto" value="rewards">Rewards</TabsTrigger> : null}
          {isAdmin ? <TabsTrigger className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-4 h-auto" value="holidays">Holidays</TabsTrigger> : null}
          {isAdmin ? <TabsTrigger className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-4 h-auto" value="notifications">Notifications</TabsTrigger> : null}
          {isAdmin ? <TabsTrigger className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-4 h-auto" value="attendance">Attendance</TabsTrigger> : null}
          {isAdmin ? <TabsTrigger className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-4 h-auto" value="billing">Billing</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="profile" className="mt-5">
          <SettingsProfileTab />
        </TabsContent>
        {isAdmin ? (
          <TabsContent value="workspace" className="mt-5">
            <SettingsWorkspaceTab />
          </TabsContent>
        ) : null}
        {isAdmin ? (
          <TabsContent value="leave" className="mt-5">
            <SettingsLeaveTab />
          </TabsContent>
        ) : null}
        {isAdmin ? (
          <TabsContent value="shoutouts" className="mt-5">
            <SettingsShoutoutsTab />
          </TabsContent>
        ) : null}
        {isAdmin ? (
          <TabsContent value="rewards" className="mt-5">
            <SettingsRewardsTab />
          </TabsContent>
        ) : null}
        {isAdmin ? (
          <TabsContent value="holidays" className="mt-5">
            <SettingsHolidaysTab />
          </TabsContent>
        ) : null}
        {isAdmin ? (
          <TabsContent value="notifications" className="mt-5">
            <SettingsNotificationsTab />
          </TabsContent>
        ) : null}
        {isAdmin ? (
          <TabsContent value="attendance" className="mt-5">
            <SettingsAttendanceTab />
          </TabsContent>
        ) : null}
        {isAdmin ? (
          <TabsContent value="billing" className="mt-5">
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
