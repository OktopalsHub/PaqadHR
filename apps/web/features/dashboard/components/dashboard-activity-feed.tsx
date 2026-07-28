'use client';

import { formatDistanceToNow } from 'date-fns';
import { Activity } from 'lucide-react';
import Link from 'next/link';
import { ContentCard } from '@/components/content-card';
import { PersonAvatar } from '@/components/person-avatar';
import {
  formatActivityActor,
  getActivityPresentation,
} from '@/features/activity/lib/activity-format';
import { useTenantActivities } from '@/hooks/queries/use-activities';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import { isTenantAdmin } from '@/lib/auth/manager-access';
import { cn } from '@/lib/utils';
import { useTenant } from '@/providers/tenant-provider';

export function DashboardActivityFeed() {
  const { tenant } = useTenant();
  const tenantHref = useTenantHref();
  const isAdmin = isTenantAdmin(tenant?.member?.role);
  const { data, isLoading } = useTenantActivities({ enabled: true, limit: 8 });

  const items = data?.items ?? [];

  return (
    <ContentCard
      title="Recent activity"
      className="dashboard-panel min-w-0 h-full rounded-[8px]"
      headerClassName="border-b border-border/60 px-5 py-4"
      titleClassName="text-[17px] font-semibold text-foreground"
      bodyClassName="min-w-0 flex-1 space-y-3 p-4 sm:p-5"
      action={
        isAdmin ? (
          <Link href={tenantHref('activity')} className="dashboard-link text-xs font-semibold">
            View all
          </Link>
        ) : undefined
      }
    >
      {isLoading ? (
        <FeedMessage text="Loading recent activity…" />
      ) : items.length === 0 ? (
        <FeedMessage text="Activity will appear here as your team works across the workspace." />
      ) : (
        items.map((activity) => {
          const { icon: Icon, iconClassName, title } = getActivityPresentation(activity);
          const actor = formatActivityActor(activity.actorName, activity.actorMemberId);
          const failed = activity.status?.toLowerCase() === 'failed';
          return (
            <div
              key={activity.id}
              className="dashboard-soft-tile rounded-[8px] flex items-start gap-3 p-3.5"
            >
              <div
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-[8px] border border-border/50 shadow-sm',
                  iconClassName,
                )}
              >
                <Icon className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <PersonAvatar
                    src={activity.actorAvatarUrl}
                    name={actor}
                    className="size-6 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {title}
                      {failed ? ' (failed)' : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {actor} ·{' '}
                      {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </ContentCard>
  );
}

function FeedMessage({ text }: { text: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
      <Activity className="size-8 text-muted-foreground" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
