'use client';

import { Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { useTenantHref, useTenantNavItems } from '@/hooks/use-tenant-nav-items';
import { NavMain } from './nav-main';
import { WorkspaceSwitcher } from './workspace-switcher';

export const AppSidebar = ({ ...props }: React.ComponentProps<typeof Sidebar>) => {
  const navItems = useTenantNavItems();
  const tenantHref = useTenantHref();
  const pathname = usePathname();
  const settingsHref = tenantHref('settings');
  const isSettingsActive = pathname.startsWith(settingsHref);

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border/60 bg-card/80 backdrop-blur-xl"
      {...props}
    >
      <SidebarHeader className="border-b border-border/60 px-2 py-3">
        <div className="relative flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:flex-none">
            <WorkspaceSwitcher />
          </div>
          <SidebarTrigger className="hidden size-8 shrink-0 rounded-[10px] border border-[#d7e3f6] bg-white text-slate-700 shadow-[0_12px_20px_-18px_rgba(11,28,48,0.35)] hover:bg-white dark:border-slate-700 dark:bg-slate-950/85 dark:text-slate-200 dark:hover:bg-slate-900 md:flex group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:right-0 group-data-[collapsible=icon]:top-1/2 group-data-[collapsible=icon]:-translate-y-1/2" />
        </div>
      </SidebarHeader>
      <SidebarContent className="px-1.5 pb-2 pt-5">
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter className="border-t border-border/60 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isSettingsActive}
              tooltip="Settings"
              className="h-11 rounded-md px-3"
            >
              <Link href={settingsHref}>
                <Settings className="size-4.5" />
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
