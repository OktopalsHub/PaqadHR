"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { AppBreadcrumb } from "./app-breadcrumb";
import { AccountSetting } from "./account-setting";
import { NotificationBell } from "./notification-bell";
import { QuickActionsMenu } from "./quick-actions-menu";

export const AppTopBar = () => {
  const { logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 flex h-12 shrink-0 items-center justify-between border-b border-border/60 bg-background px-3 md:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <SidebarTrigger className="size-8 shrink-0 md:hidden" />
        <AppBreadcrumb />
      </div>
      <div className="flex items-center">
        <div className="flex items-center gap-1.5">
          <NotificationBell />
          <QuickActionsMenu />
        </div>
        <div
          className="mx-3 hidden h-6 w-px bg-border/80 sm:block"
          aria-hidden
        />
        <AccountSetting logout={logout} />
      </div>
    </header>
  );
};
