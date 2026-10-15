'use client';

import { Megaphone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from '@/hooks/queries/use-notifications';
import type { AppNotification } from '@/lib/api/notifications';
import { isTenantAdmin } from '@/lib/auth/manager-access';
import { cn } from '@/lib/utils';
import { useTenant } from '@/providers/tenant-provider';
import { NotificationItem } from './notification-item';
import { SendNotificationForm } from './send-notification-form';

const SIDEBAR_NOTIFICATIONS_LIMIT = 50;

type Filter = 'all' | 'unread';

export function NotificationSidebar({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [composing, setComposing] = useState(false);
  const { tenant } = useTenant();
  const isAdmin = isTenantAdmin(tenant?.member?.role);

  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const { data, isLoading } = useNotifications({
    enabled: open && !composing,
    limit: SIDEBAR_NOTIFICATIONS_LIMIT,
  });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotificationMutation = useDeleteNotification();

  const notifications = data?.notifications ?? [];
  const visible =
    filter === 'unread' ? notifications.filter((item) => !item.readAt) : notifications;

  const handleSelect = async (notification: AppNotification) => {
    if (!notification.readAt) {
      try {
        await markRead.mutateAsync(notification.id);
      } catch {}
    }

    onOpenChange(false);

    const url = notification.actionData?.url;
    if (url) {
      const hasProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(url);
      const isInternalPath = url.startsWith('/') && !url.startsWith('//');
      if (hasProtocol) {
        window.location.assign(url);
      } else if (isInternalPath) {
        router.push(url);
      }
    }
  };

  const handleDelete = async (notification: AppNotification) => {
    try {
      await deleteNotificationMutation.mutateAsync(notification.id);
    } catch {
      toast.error('Failed to delete notification');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        {composing ? (
          <>
            <SheetHeader className="border-b">
              <SheetTitle>New announcement</SheetTitle>
              <SheetDescription>
                Send a notification to every active member of your workspace.
              </SheetDescription>
            </SheetHeader>
            <SendNotificationForm onBack={() => setComposing(false)} />
          </>
        ) : (
          <>
            <SheetHeader className="border-b pb-3">
              <div className="flex items-center justify-between pr-8">
                <div>
                  <SheetTitle>Notifications</SheetTitle>
                  <SheetDescription>
                    {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
                  </SheetDescription>
                </div>
                {unreadCount > 0 ? (
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
              <div className="mt-2 flex items-center gap-2">
                <div className="bg-muted inline-flex rounded-lg p-0.5">
                  {(['all', 'unread'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilter(value)}
                      className={cn(
                        'rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors',
                        filter === value
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              {isAdmin ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-fit gap-1.5 text-xs"
                  onClick={() => setComposing(true)}
                >
                  <Megaphone className="size-3.5" />
                  Send announcement
                </Button>
              ) : null}
            </SheetHeader>

            <ScrollArea className="flex-1">
              <div className="px-2 py-2">
                {isLoading ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</p>
                ) : visible.length === 0 ? (
                  <p className="px-3 py-10 text-center text-sm text-muted-foreground">
                    {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                  </p>
                ) : (
                  visible.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onSelect={handleSelect}
                      onDelete={handleDelete}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
