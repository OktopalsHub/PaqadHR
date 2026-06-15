'use client';

import { Settings } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { navItems } from '../constants/nav-items';

type LandingMockSidebarProps = {
  activeHref: string;
  onNavSelect: (href: string, name: string) => void;
};

function LandingWorkspaceHeader() {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
        P
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold tracking-tight">Paqad</p>
        <p className="truncate text-xs text-muted-foreground">Workspace</p>
      </div>
    </div>
  );
}

function isNavActive(activeHref: string, itemHref: string) {
  return itemHref === '/app' ? activeHref === '/app' : activeHref.startsWith(itemHref);
}

function LandingMockSidebarNav({ activeHref, onNavSelect }: LandingMockSidebarProps) {
  const mainItems = navItems.filter((item) => item.href !== '/app/settings');

  return (
    <>
      <SidebarHeader className="border-b border-border/60 px-2 py-3">
        <LandingWorkspaceHeader />
      </SidebarHeader>

      <SidebarContent className="px-1.5 py-2">
        <SidebarMenu className="gap-1">
          {mainItems.map((item) => (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton
                isActive={isNavActive(activeHref, item.href)}
                tooltip={item.name}
                className="h-10 rounded-xl px-3"
                onClick={() => onNavSelect(item.href, item.name)}
              >
                <item.icon className="size-[18px]" />
                <span>{item.name}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/60 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={isNavActive(activeHref, '/app/settings')}
              tooltip="Settings"
              className="h-10 rounded-xl px-3"
              onClick={() => onNavSelect('/app/settings', 'Settings')}
            >
              <Settings className="size-[18px]" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}

export function LandingMockSidebar(props: LandingMockSidebarProps) {
  return (
    <SidebarProvider className="min-h-0 w-auto">
      <Sidebar
        collapsible="none"
        className="h-full w-(--sidebar-width) shrink-0 border-r border-border/60 bg-card/80 backdrop-blur-xl"
      >
        <LandingMockSidebarNav {...props} />
      </Sidebar>
    </SidebarProvider>
  );
}
