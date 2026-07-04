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
    <div className="flex items-start gap-3 py-3.5">
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          iconClassName,
        )}
      >
        <Icon className="size-4" aria-hidden />
      </div>

      <div className="min-w-0 flex-1">
        <p className={cn('text-sm leading-snug', failed && 'text-destructive')}>{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {actor}
          <span aria-hidden> · </span>
          <time dateTime={activity.createdAt}>{timeLabel}</time>
        </p>
      </div>

      {href ? (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-0.5 pt-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          View
          <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
