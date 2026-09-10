'use client';

import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  CalendarDays,
  CreditCard,
  Gift,
  Heart,
  PlugZap,
  UserRound,
} from 'lucide-react';
// Bell removed while notifications tab is commented out
// import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import { isTenantAdmin } from '@/lib/auth/manager-access';
import { useTenant } from '@/providers/tenant-provider';
import {
  getVisibleSettingsTabs,
  resolveSettingsTab,
  SETTINGS_TAB_LABELS,
  type SettingsTab,
  settingsTabHref,
} from '../lib/settings-tabs';

const SETTINGS_TAB_ICONS: Record<SettingsTab, LucideIcon> = {
  profile: UserRound,
  workspace: Building2,
  leave: CalendarClock,
  shoutouts: Heart,
  rewards: Gift,
  holidays: CalendarDays,
  // notifications: Bell,
  attendance: CalendarClock,
  billing: CreditCard,
  integrations: PlugZap,
};

export function SettingsSidebarNav() {
  const searchParams = useSearchParams();
  const { tenant } = useTenant();
  const tenantHref = useTenantHref();
  const settingsBase = tenantHref('settings');
  const isAdmin = isTenantAdmin(tenant?.member?.role);
  const activeTab = resolveSettingsTab(searchParams.get('tab'), isAdmin);
  const visibleTabs = getVisibleSettingsTabs(isAdmin);

  return (
    <div className="flex h-full flex-col">
      <SidebarGroup className="p-0">
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Back to workspace" className="h-11 rounded-md px-3">
              <Link href={tenantHref()}>
                <ArrowLeft className="size-[18px]" />
                <span>Back to workspace</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup className="p-0">
        <SidebarMenu className="gap-1">
          {visibleTabs.map((tab) => {
            const Icon = SETTINGS_TAB_ICONS[tab];

            return (
              <SidebarMenuItem key={tab}>
                <SidebarMenuButton
                  asChild
                  isActive={activeTab === tab}
                  tooltip={SETTINGS_TAB_LABELS[tab]}
                  className="h-11 rounded-md px-3"
                >
                  <Link href={settingsTabHref(settingsBase, tab)}>
                    <Icon className="size-[18px]" />
                    <span>{SETTINGS_TAB_LABELS[tab]}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroup>
    </div>
  );
}
