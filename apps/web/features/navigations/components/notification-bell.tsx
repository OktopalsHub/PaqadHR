'use client';

import { Bell } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { NotificationSidebar } from '@/features/notifications/components/notification-sidebar';
import {
  useNotificationStream,
  useUnreadNotificationCount,
} from '@/hooks/queries/use-notifications';

function formatUnreadBadge(count: number) {
  if (count <= 0) return null;
  return count > 9 ? '9+' : String(count);
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: unreadCount = 0 } = useUnreadNotificationCount();

  useNotificationStream();

  const badge = formatUnreadBadge(unreadCount);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Notifications${badge ? `, ${unreadCount} unread` : ''}`}
        className="relative size-9 rounded-full border border-border/70 bg-background/90"
        onClick={() => setOpen(true)}
      >
        <Bell className="size-4 drop-shadow-[0_1px_2px_rgba(11,28,48,0.18)]" />
        {badge ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
            {badge}
          </span>
        ) : null}
      </Button>
      <NotificationSidebar open={open} onOpenChange={setOpen} />
    </>
  );
}
