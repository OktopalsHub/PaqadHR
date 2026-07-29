'use client';

import { formatDistanceToNow } from 'date-fns';
import { Activity } from 'lucide-react';
import Link from 'next/link';
import { ContentCard } from '@/components/content-card';
import { getActivityPresentation } from '@/features/activity/lib/activity-format';
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
      bodyClassName="min-w-0 flex-1 space-y-2.5 p-4 sm:p-5"
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
          const failed = activity.status?.toLowerCase() === 'failed';
          const timeAgo = formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true });

          return (
            <div
              key={activity.id}
              className={cn(
                'dashboard-soft-tile rounded-[10px] border border-border/60 px-3 py-2.5 transition-[border-color,box-shadow,background-color] hover:border-primary/20 hover:bg-background/75 hover:shadow-sm',
                failed && 'border-destructive/20 bg-destructive/5',
              )}
            >
              <div className="flex flex-wrap items-center gap-2.5 sm:flex-nowrap">
                <div
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-white/70 shadow-sm',
                    iconClassName,
                    failed && 'border-destructive/15 bg-destructive/10 text-destructive',
                  )}
                >
                  <Icon className="size-3.5" />
                </div>

                <p
                  className={cn(
                    'min-w-0 flex-1 truncate text-sm font-semibold leading-snug text-foreground',
                    failed && 'text-destructive',
                  )}
                >
                  {title}
                </p>

                {failed ? (
                  <span className="inline-flex shrink-0 items-center rounded-full bg-destructive/10 px-2 py-0.75 text-[11px] font-semibold text-destructive">
                    Failed
                  </span>
                ) : null}

                <span className="inline-flex shrink-0 items-center rounded-full border border-border/50 bg-background/70 px-2 py-0.75 text-[11px] font-medium text-muted-foreground">
                  {timeAgo}
                </span>
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
