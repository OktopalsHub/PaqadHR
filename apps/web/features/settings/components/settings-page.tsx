'use client';

import { useEffect } from 'react';
import { AppPage } from '@/components/app-page';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { FeatureGate } from '@/features/billing/components/feature-gate';
import { SettingsAttendanceTab } from '@/features/settings/components/settings-attendance-tab';
import { SettingsBillingTab } from '@/features/settings/components/settings-billing-tab';
import { SettingsHolidaysTab } from '@/features/settings/components/settings-holidays-tab';
import { SettingsIntegrationsTab } from '@/features/settings/components/settings-integrations-tab';
import { SettingsLeaveTab } from '@/features/settings/components/settings-leave-tab';
import { SettingsProfileTab } from '@/features/settings/components/settings-profile-tab';
import { SettingsRewardsTab } from '@/features/settings/components/settings-rewards-tab';
import { SettingsShoutoutsTab } from '@/features/settings/components/settings-shoutouts-tab';
import { SettingsWorkspaceTab } from '@/features/settings/components/settings-workspace-tab';
// import { SettingsNotificationsTab } from '@/features/settings/components/settings-notifications-tab';
import {
  getVisibleSettingsTabs,
  isSettingsTab,
  resolveSettingsTab,
  SETTINGS_TAB_LABELS,
} from '@/features/settings/lib/settings-tabs';
import { useUrlTab } from '@/hooks/use-url-tab';
import { FeatureAccess } from '@/lib/constants/feature-access';
import { useBreadcrumbTail } from '@/providers/breadcrumb-provider';
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
  useBreadcrumbTail(SETTINGS_TAB_LABELS[visibleTab]);

  return (
    <AppPage className="space-y-6">
      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.035em] text-slate-950 dark:text-slate-50">
          Settings
        </h1>
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
            <FeatureGate feature={FeatureAccess.INTEGRATIONS}>
              <SettingsShoutoutsTab />
            </FeatureGate>
          </TabsContent>
        ) : null}
        {visibleTabs.includes('rewards') ? (
          <TabsContent value="rewards" className="mt-0 data-[state=inactive]:hidden">
            <FeatureGate feature={FeatureAccess.INTEGRATIONS}>
              <SettingsRewardsTab />
            </FeatureGate>
          </TabsContent>
        ) : null}
        {visibleTabs.includes('holidays') ? (
          <TabsContent value="holidays" className="mt-0 data-[state=inactive]:hidden">
            <SettingsHolidaysTab />
          </TabsContent>
        ) : null}
        {/* Notifications tab temporarily hidden from settings
        {visibleTabs.includes('notifications') ? (
          <TabsContent value="notifications" className="mt-0 data-[state=inactive]:hidden">
            <SettingsNotificationsTab />
          </TabsContent>
        ) : null}
        */}
        {visibleTabs.includes('attendance') ? (
          <TabsContent value="attendance" className="mt-0 data-[state=inactive]:hidden">
            <FeatureGate feature={FeatureAccess.ATTENDANCE}>
              <SettingsAttendanceTab />
            </FeatureGate>
          </TabsContent>
        ) : null}
        {visibleTabs.includes('billing') ? (
          <TabsContent value="billing" className="mt-0 data-[state=inactive]:hidden">
            <SettingsBillingTab />
          </TabsContent>
        ) : null}
        {visibleTabs.includes('integrations') ? (
          <TabsContent value="integrations" className="mt-0 data-[state=inactive]:hidden">
            <FeatureGate feature={FeatureAccess.INTEGRATIONS}>
              <SettingsIntegrationsTab />
            </FeatureGate>
          </TabsContent>
        ) : null}
      </Tabs>
    </AppPage>
  );
}
