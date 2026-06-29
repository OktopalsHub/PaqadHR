'use client';

import { formatDistanceToNow } from 'date-fns';
import { Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { AppNotification } from '@/lib/api/notifications';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationStream,
  useNotifications,
  useUnreadNotificationCount,
} from '@/hooks/queries/use-notifications';
import { cn } from '@/lib/utils';

function formatUnreadBadge(count: number) {
  if (count <= 0) return null;
  return count > 9 ? '9+' : String(count);
}

function NotificationItem({
  notification,
  onSelect,
}: {
  notification: AppNotification;
  onSelect: (notification: AppNotification) => void;
}) {
  const isUnread = !notification.readAt;
  const timeLabel = formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true });

  return (
    <DropdownMenuItem
      className={cn(
        'flex cursor-pointer flex-col items-start gap-0.5 rounded-lg px-3 py-2.5',
        isUnread && 'bg-muted/50',
      )}
      onSelect={(event) => {
        event.preventDefault();
        onSelect(notification);
      }}
    >
      <div className="flex w-full items-start gap-2">
        {isUnread ? (
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
        ) : (
          <span className="mt-1.5 size-1.5 shrink-0" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{notification.title}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{notification.message}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">{timeLabel}</p>
        </div>
      </div>
    </DropdownMenuItem>
  );
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const { data, isLoading, refetch } = useNotifications({ enabled: open });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  useNotificationStream();

  const badge = formatUnreadBadge(unreadCount);
  const notifications = data?.notifications ?? [];
  const hasUnread = unreadCount > 0;

  const handleSelect = async (notification: AppNotification) => {
    if (!notification.readAt && notification.recipientId) {
      try {
        await markRead.mutateAsync(notification.id);
      } catch {
      }
    }

    setOpen(false);

    const url = notification.actionData?.url;
    if (url) {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        window.location.assign(url);
      } else {
        router.push(url);
      }
    }
  };

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void refetch();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-8 rounded-lg">
          <Bell className="size-4" />
          {badge ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {badge}
            </span>
          ) : null}
          <span className="sr-only">
            Notifications{badge ? `, ${unreadCount} unread` : ''}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 rounded-xl p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">Notifications</DropdownMenuLabel>
          {hasUnread ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              Mark all read
            </Button>
          ) : null}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <ScrollArea className="max-h-80">
          {isLoading ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No notifications yet
            </p>
          ) : (
            <div className="p-1">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
