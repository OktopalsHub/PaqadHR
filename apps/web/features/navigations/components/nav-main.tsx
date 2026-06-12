"use client";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
// import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";
import Link from "next/link";

export const NavMain = ({
  items,
}: {
  items: {
    name: string;
    href: string;
    icon: LucideIcon;
    isActive?: boolean;
    gradient: string;
  }[];
}) => {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Overview</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton
              asChild
              tooltip={item.name}
              isActive={item.isActive}
              className="text-xs"
            >
              <Link href={item.href} className="relative">
                {item.icon && <item.icon />}
                <span>{item.name}</span>
                {/* {item.isActive && ( */}
                {/*   <div */}
                {/*     className={cn( */}
                {/*       "absolute inset-0 bg-gradient-to-r opacity-10 rounded-xl", */}
                {/*       item.gradient, */}
                {/*     )} */}
                {/*   /> */}
                {/* )} */}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
};
