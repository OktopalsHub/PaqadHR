'use client';

import { Suspense, useEffect } from 'react';
import { AppPage } from '@/components/app-page';
import { LoadingBlock } from '@/components/loading-block';
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
      <Tabs value={visibleTab} className="space-y-5">
        <TabsContent value="profile" className="mt-0 data-[state=inactive]:hidden">
          {visibleTab === 'profile' && (
            <Suspense fallback={<LoadingBlock />}>
              <SettingsProfileTab />
            </Suspense>
          )}
        </TabsContent>
        {visibleTabs.includes('workspace') ? (
          <TabsContent value="workspace" className="mt-0 data-[state=inactive]:hidden">
            {visibleTab === 'workspace' && (
              <Suspense fallback={<LoadingBlock />}>
                <SettingsWorkspaceTab />
              </Suspense>
            )}
          </TabsContent>
        ) : null}
        {visibleTabs.includes('leave') ? (
          <TabsContent value="leave" className="mt-0 data-[state=inactive]:hidden">
            {visibleTab === 'leave' && (
              <Suspense fallback={<LoadingBlock />}>
                <SettingsLeaveTab />
              </Suspense>
            )}
          </TabsContent>
        ) : null}
        {visibleTabs.includes('shoutouts') ? (
          <TabsContent value="shoutouts" className="mt-0 data-[state=inactive]:hidden">
            {visibleTab === 'shoutouts' && (
              <Suspense fallback={<LoadingBlock />}>
                <FeatureGate feature={FeatureAccess.INTEGRATIONS}>
                  <SettingsShoutoutsTab />
                </FeatureGate>
              </Suspense>
            )}
          </TabsContent>
        ) : null}
        {visibleTabs.includes('rewards') ? (
          <TabsContent value="rewards" className="mt-0 data-[state=inactive]:hidden">
            {visibleTab === 'rewards' && (
              <Suspense fallback={<LoadingBlock />}>
                <FeatureGate feature={FeatureAccess.INTEGRATIONS}>
                  <SettingsRewardsTab />
                </FeatureGate>
              </Suspense>
            )}
          </TabsContent>
        ) : null}
        {visibleTabs.includes('holidays') ? (
          <TabsContent value="holidays" className="mt-0 data-[state=inactive]:hidden">
            {visibleTab === 'holidays' && (
              <Suspense fallback={<LoadingBlock />}>
                <SettingsHolidaysTab />
              </Suspense>
            )}
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
            {visibleTab === 'attendance' && (
              <Suspense fallback={<LoadingBlock />}>
                <FeatureGate feature={FeatureAccess.ATTENDANCE}>
                  <SettingsAttendanceTab />
                </FeatureGate>
              </Suspense>
            )}
          </TabsContent>
        ) : null}
        {visibleTabs.includes('billing') ? (
          <TabsContent value="billing" className="mt-0 data-[state=inactive]:hidden">
            {visibleTab === 'billing' && (
              <Suspense fallback={<LoadingBlock />}>
                <SettingsBillingTab />
              </Suspense>
            )}
          </TabsContent>
        ) : null}
        {visibleTabs.includes('integrations') ? (
          <TabsContent value="integrations" className="mt-0 data-[state=inactive]:hidden">
            {visibleTab === 'integrations' && (
              <Suspense fallback={<LoadingBlock />}>
                <FeatureGate feature={FeatureAccess.INTEGRATIONS}>
                  <SettingsIntegrationsTab />
                </FeatureGate>
              </Suspense>
            )}
          </TabsContent>
        ) : null}
      </Tabs>
    </AppPage>
  );
}
