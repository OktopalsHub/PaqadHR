'use client';

import { format } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { TenantActivity } from '@/lib/api/activities';
import { cn } from '@/lib/utils';
import { formatActivityActor, getActivityPresentation } from '../lib/activity-format';
import { getActivityHref } from '../lib/activity-routes';

type ActivityLogItemProps = {
  activity: TenantActivity;
  tenantSlug: string;
};

export function ActivityLogItem({ activity, tenantSlug }: ActivityLogItemProps) {
  const { icon: Icon, iconClassName, title } = getActivityPresentation(activity);
  const actor = formatActivityActor(activity.actorName);
  const createdAt = new Date(activity.createdAt);
  const timeLabel = format(createdAt, 'h:mm a');
  const href = getActivityHref(tenantSlug, activity);
  const failed = activity.status?.toLowerCase() === 'failed';

  return (
    <div
      className={cn(
        'dashboard-soft-tile flex items-start gap-3 rounded-[8px] border px-4 py-3.5 transition-[border-color,box-shadow,background-color] hover:border-primary/25 hover:bg-white/85 hover:shadow-sm dark:hover:bg-slate-900/85',
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p
              className={cn(
                'text-sm font-medium leading-snug text-slate-900 dark:text-slate-100',
                failed && 'text-destructive',
              )}
            >
              {title}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-600 dark:text-slate-300">{actor}</span>
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

          {href ? (
            <Link
              href={href}
              className="inline-flex h-8 shrink-0 items-center gap-0.5 rounded-[8px] border border-border/70 bg-background/80 px-2.5 text-xs font-semibold text-slate-600 transition-colors hover:border-primary/25 hover:text-primary dark:bg-slate-950/70 dark:text-slate-300"
            >
              Open
              <ChevronRight className="size-3.5" aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
