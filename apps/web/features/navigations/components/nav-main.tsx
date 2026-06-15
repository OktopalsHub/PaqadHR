'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import type { NavItem } from '../constants/nav-items';

export const NavMain = ({ items }: { items: NavItem[] }) => {
  const pathname = usePathname();
  const dashboardHref = items.find((item) => item.segment === '')?.href;
  const mainItems = items.filter((item) => item.segment !== 'settings');

  return (
    <SidebarGroup className="p-0">
      <SidebarMenu className="gap-1">
        {mainItems.map((item) => {
          const isActive =
            item.href === dashboardHref
              ? pathname === dashboardHref
              : pathname.startsWith(item.href);

          return (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton
                asChild
                isActive={isActive}
                tooltip={item.name}
                className="h-10 rounded-xl px-3"
              >
                <Link href={item.href}>
                  <item.icon className="size-[18px]" />
                  <span>{item.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
};
