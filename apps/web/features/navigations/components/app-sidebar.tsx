'use client';

import { Settings } from 'lucide-react';
import Link from 'next/link';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { useTenantHref, useTenantNavItems } from '@/hooks/use-tenant-nav-items';
import { NavMain } from './nav-main';
import { WorkspaceSwitcher } from './workspace-switcher';

export const AppSidebar = ({ ...props }: React.ComponentProps<typeof Sidebar>) => {
  const navItems = useTenantNavItems();
  const tenantHref = useTenantHref();
  const settingsHref = tenantHref('settings');

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border/60 bg-card/80 backdrop-blur-xl"
      {...props}
    >
      <SidebarHeader className="border-b border-border/60 px-2 py-3">
        <WorkspaceSwitcher />
      </SidebarHeader>
      <SidebarContent className="px-1.5 py-2">
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter className="border-t border-border/60 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Settings">
              <Link href={settingsHref}>
                <Settings />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};
