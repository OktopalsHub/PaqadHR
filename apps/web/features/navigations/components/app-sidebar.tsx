"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavMain } from "./nav-main";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { navItems } from "../constants/nav-items";

export const AppSidebar = ({
  ...props
}: React.ComponentProps<typeof Sidebar>) => {
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
              <Link href="/app/settings">
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
