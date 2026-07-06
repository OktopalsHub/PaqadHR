'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { ClockInOutControl } from '@/features/attendance/components/clock-in-out-control';
import { useAuth } from '@/hooks/use-auth';
import { AccountSetting } from './account-setting';
import { AppBreadcrumb } from './app-breadcrumb';
import { NotificationBell } from './notification-bell';
import { QuickActionsMenu } from './quick-actions-menu';

export const AppTopBar = () => {
  const { logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-background/95 px-2.5 shadow-[0_10px_28px_-20px_rgba(11,28,48,0.32)] backdrop-blur sm:h-16 sm:px-3 md:h-[72px] md:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        <SidebarTrigger className="size-9 shrink-0 rounded-full border border-border/70 bg-background shadow-[0_6px_18px_-12px_rgba(11,28,48,0.28)] md:hidden" />
        <AppBreadcrumb />
      </div>
      <div className="flex shrink-0 items-center">
        <div className="flex items-center gap-1.5 [&_button]:shadow-[0_6px_18px_-12px_rgba(11,28,48,0.28)] [&_button]:transition-[box-shadow,background-color,border-color] [&_button:hover]:shadow-[0_10px_22px_-14px_rgba(11,28,48,0.34)] sm:gap-2">
          <ClockInOutControl />
          <NotificationBell />
          <QuickActionsMenu />
        </div>
        <div
          className="mx-2 hidden h-7 w-px bg-border/85 shadow-[0_0_10px_rgba(11,28,48,0.12)] sm:block"
          aria-hidden
        />
        <AccountSetting logout={logout} />
      </div>
    </header>
  );
};
