'use client';

import { formatDistanceToNow } from 'date-fns';
import {
  Banknote,
  Bell,
  CalendarDays,
  Gift,
  type LucideIcon,
  Megaphone,
  PartyPopper,
  ShieldAlert,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AppNotification } from '@/lib/api/notifications';
import { cn } from '@/lib/utils';

const TYPE_ICONS: Record<string, LucideIcon> = {
  points_awarded: Sparkles,
  task_completion_points: Gift,
  tenant_broadcast: Megaphone,
  payroll: Banknote,
  payslip_published: Banknote,
  leave_request: CalendarDays,
  shoutout: PartyPopper,
  security_alert: ShieldAlert,
};

function iconFor(notification: AppNotification): LucideIcon {
  const metadataType =
    typeof notification.metadata?.type === 'string' ? notification.metadata.type : undefined;
  return (metadataType && TYPE_ICONS[metadataType]) || Bell;
}

export function NotificationItem({
  notification,
  onSelect,
  onDelete,
}: {
  notification: AppNotification;
  onSelect: (notification: AppNotification) => void;
  onDelete?: (notification: AppNotification) => void;
}) {
  const isUnread = !notification.readAt;
  const Icon = iconFor(notification);
  const timeLabel = formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true });

  return (
    <button
      type="button"
      onClick={() => onSelect(notification)}
      className={cn(
        'group hover:bg-muted/60 flex w-full cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
        isUnread && 'bg-muted/40',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
          isUnread ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
        )}
        aria-hidden
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {isUnread ? (
            <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
          ) : null}
          <p className={cn('truncate text-sm leading-snug', isUnread && 'font-medium')}>
            {notification.title}
          </p>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{notification.message}</p>
        <p className="mt-1 text-[10px] text-muted-foreground">{timeLabel}</p>
      </div>
      {onDelete ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete notification"
          className="text-muted-foreground hover:text-destructive mt-0.5 hidden size-7 shrink-0 group-hover:flex"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(notification);
          }}
        >
          <Trash2 className="size-3.5" />
        </Button>
      ) : null}
    </button>
  );
}
