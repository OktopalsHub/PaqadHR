'use client';

import { useEffect } from 'react';
import { AppPage } from '@/components/app-page';
import { Tabs, TabsContent } from '@/components/ui/tabs';
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
  getVisibleSettingsTabs,
  isSettingsTab,
  resolveSettingsTab,
  SETTINGS_TAB_LABELS,
} from '@/features/settings/lib/settings-tabs';
import { useUrlTab } from '@/hooks/use-url-tab';
import { useTenant } from '@/providers/tenant-provider';

export function SettingsPage() {
  const { tenant } = useTenant();
  const [activeTab, setTab] = useUrlTab(isSettingsTab, 'profile');

  const role = tenant?.member?.role?.toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin';
  const visibleTab = resolveSettingsTab(activeTab, isAdmin);

  useEffect(() => {
    if (activeTab !== visibleTab) {
      setTab(visibleTab);
    }
  }, [activeTab, setTab, visibleTab]);

  const visibleTabs = getVisibleSettingsTabs(isAdmin);

  return (
    <AppPage className="space-y-6">
      <div className="space-y-1.5">
        <p className="dashboard-outline-label text-[11px] font-semibold uppercase">
          {SETTINGS_TAB_LABELS[visibleTab]}
        </p>
        <h1 className="text-[30px] font-semibold tracking-[-0.035em] text-slate-950 dark:text-slate-50">
          Settings
        </h1>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Manage your account preferences and workspace configuration.
        </p>
      </div>

      <Tabs value={visibleTab} className="space-y-5">
        <TabsContent value="profile" className="mt-0 data-[state=inactive]:hidden">
          <SettingsProfileTab />
        </TabsContent>
        {visibleTabs.includes('workspace') ? (
          <TabsContent value="workspace" className="mt-0 data-[state=inactive]:hidden">
            <SettingsWorkspaceTab />
          </TabsContent>
        ) : null}
        {visibleTabs.includes('leave') ? (
          <TabsContent value="leave" className="mt-0 data-[state=inactive]:hidden">
            <SettingsLeaveTab />
          </TabsContent>
        ) : null}
        {visibleTabs.includes('shoutouts') ? (
          <TabsContent value="shoutouts" className="mt-0 data-[state=inactive]:hidden">
            <SettingsShoutoutsTab />
          </TabsContent>
        ) : null}
        {visibleTabs.includes('rewards') ? (
          <TabsContent value="rewards" className="mt-0 data-[state=inactive]:hidden">
            <SettingsRewardsTab />
          </TabsContent>
        ) : null}
        {visibleTabs.includes('holidays') ? (
          <TabsContent value="holidays" className="mt-0 data-[state=inactive]:hidden">
            <SettingsHolidaysTab />
          </TabsContent>
        ) : null}
        {visibleTabs.includes('notifications') ? (
          <TabsContent value="notifications" className="mt-0 data-[state=inactive]:hidden">
            <SettingsNotificationsTab />
          </TabsContent>
        ) : null}
        {visibleTabs.includes('attendance') ? (
          <TabsContent value="attendance" className="mt-0 data-[state=inactive]:hidden">
            <SettingsAttendanceTab />
          </TabsContent>
        ) : null}
        {visibleTabs.includes('billing') ? (
          <TabsContent value="billing" className="mt-0 data-[state=inactive]:hidden">
            <SettingsBillingTab />
          </TabsContent>
        ) : null}
        {visibleTabs.includes('integrations') ? (
          <TabsContent value="integrations" className="mt-0 data-[state=inactive]:hidden">
            <SettingsIntegrationsTab />
          </TabsContent>
        ) : null}
      </Tabs>
    </AppPage>
  );
}
