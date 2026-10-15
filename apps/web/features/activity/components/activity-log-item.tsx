'use client';

import { format } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import { PersonAvatar } from '@/components/person-avatar';
import type { TenantActivity } from '@/lib/api/activities';
import { cn } from '@/lib/utils';
import { formatActivityActor, getActivityPresentation } from '../lib/activity-format';

type ActivityLogItemProps = {
  activity: TenantActivity;
  onSelect: (activity: TenantActivity) => void;
};

export function ActivityLogItem({ activity, onSelect }: ActivityLogItemProps) {
  const { icon: Icon, iconClassName, title } = getActivityPresentation(activity);
  const actor = formatActivityActor(activity.actorName);
  const createdAt = new Date(activity.createdAt);
  const timeLabel = format(createdAt, 'h:mm a');
  const failed = activity.status?.toLowerCase() === 'failed';

  return (
    <button
      type="button"
      onClick={() => onSelect(activity)}
      className={cn(
        'cursor-pointer dashboard-soft-tile flex w-full items-center gap-3 rounded-[8px] border px-4 py-3.5 text-left transition-[border-color,box-shadow,background-color] hover:border-primary/25 hover:bg-white/85 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-slate-900/85',
        failed &&
          'border-destructive/25 bg-destructive/5 dark:border-destructive/30 dark:bg-destructive/10',
      )}
    >
      <div
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-[8px] border border-white/60 shadow-sm',
          iconClassName,
          failed && 'border-destructive/15 bg-destructive/10 text-destructive',
        )}
      >
        <Icon className="size-4" aria-hidden />
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-sm font-medium leading-snug text-slate-900 dark:text-slate-100',
            failed && 'text-destructive',
          )}
        >
          {title}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
            <PersonAvatar
              src={activity.actorAvatarUrl}
              name={actor}
              className="size-5 border border-border/60"
              fallbackClassName="text-[10px] font-semibold"
            />
            <span>
              <span className="font-normal text-slate-500 dark:text-slate-400">by </span>
              {actor}
            </span>
          </span>
          <span aria-hidden className="hidden sm:inline">
            •
          </span>
          <time dateTime={activity.createdAt}>{timeLabel}</time>
          {failed ? (
            <>
              <span aria-hidden className="hidden sm:inline">
                •
              </span>
              <span className="font-semibold text-destructive">Failed</span>
            </>
          ) : null}
        </div>
      </div>

      <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
    </button>
  );
}
