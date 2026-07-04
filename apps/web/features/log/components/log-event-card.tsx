'use client';

import { format, formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { PersonAvatar } from '@/components/person-avatar';
import { Badge } from '@/components/ui/badge';
import type { TenantActivity } from '@/lib/api/activities';
import { cn } from '@/lib/utils';
import { formatMetadataChips, getActivityHref } from '../lib/activity-routes';

type LogEventCardProps = {
  activity: TenantActivity;
  tenantSlug: string;
  isLast?: boolean;
};

export function LogEventCard({ activity, tenantSlug, isLast }: LogEventCardProps) {
  const createdAt = new Date(activity.createdAt);
  const relativeTime = formatDistanceToNow(createdAt, { addSuffix: true });
  const absoluteTime = format(createdAt, 'MMM d, yyyy · h:mm a');
  const actorName = activity.actorName ?? 'System';
  const href = getActivityHref(tenantSlug, activity);
  const metadataChips = formatMetadataChips(activity.metadata);

  return (
    <div className="relative flex gap-3 pb-6">
      {!isLast ? (
        <span className="absolute left-4 top-9 bottom-0 w-px bg-border/70" aria-hidden />
      ) : null}
      <div className="relative z-10 shrink-0">
        <PersonAvatar
          name={actorName}
          className="size-8 border border-background"
          fallbackClassName="bg-muted text-[10px] font-medium"
        />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium">{actorName}</span>
          <span className="text-xs text-muted-foreground" title={absoluteTime}>
            {relativeTime}
          </span>
        </div>

        <p className="text-sm leading-snug">{activity.description}</p>

        <div className="flex flex-wrap gap-1.5">
          {activity.resourceType ? (
            <Badge variant="outline" className="text-[10px] font-normal capitalize">
              {activity.resourceType.replace(/_/g, ' ')}
            </Badge>
          ) : null}
          <Badge variant="secondary" className="text-[10px] font-normal">
            {activity.action}
          </Badge>
          {activity.status ? (
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-normal capitalize',
                activity.status === 'success' && 'border-emerald-500/30 text-emerald-700',
                activity.status === 'failed' && 'border-destructive/30 text-destructive',
              )}
            >
              {activity.status}
            </Badge>
          ) : null}
          {metadataChips.map((chip) => (
            <Badge key={chip} variant="outline" className="text-[10px] font-normal">
              {chip}
            </Badge>
          ))}
        </div>

        {href ? (
          <Link
            href={href}
            className="inline-block text-xs font-medium text-primary hover:underline"
          >
            View details
          </Link>
        ) : null}
      </div>
    </div>
  );
}
