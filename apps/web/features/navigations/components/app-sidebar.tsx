"use client";

import Link from "next/link";
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
} from "@/components/ui/sidebar";
import { NavMain } from "./nav-main";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { navItems } from "../constants/nav-items";

export const AppSidebar = ({
  ...props
}: React.ComponentProps<typeof Sidebar>) => {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="relative border-b">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/app">
                <span className="font-semibold tracking-tight">Paqad</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarTrigger className="absolute top-1/2 right-[-2.75rem] z-50 size-7 -translate-y-1/2" />
      </SidebarHeader>
      <SidebarContent>
        <div className="px-2 py-3">
          <WorkspaceSwitcher />
        </div>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter />
      <SidebarRail />
    </Sidebar>
  );
};
