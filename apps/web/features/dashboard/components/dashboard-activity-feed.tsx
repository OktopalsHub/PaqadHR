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
  const { data, isLoading } = useTenantActivities({ enabled: isAdmin, limit: 8 });

  const items = data?.items ?? [];

  return (
    <ContentCard
      title="Recent activity"
      className="dashboard-panel min-w-0 h-full rounded-[8px]"
      headerClassName="border-b border-[#d7e3f6] px-5 py-4 dark:border-slate-800"
      titleClassName="text-[17px] font-semibold text-slate-950 dark:text-slate-100"
      bodyClassName="min-w-0 flex-1 space-y-3 p-4 sm:p-5"
      action={
        isAdmin ? (
          <Link href={tenantHref('activity')} className="dashboard-link text-xs font-semibold">
            View all
          </Link>
        ) : undefined
      }
    >
      {!isAdmin ? (
        <FeedMessage text="Workspace activity is visible to owners and admins." />
      ) : isLoading ? (
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
                  'flex size-8 shrink-0 items-center justify-center rounded-[8px] border border-white/60 shadow-sm',
                  iconClassName,
                  failed && 'border-destructive/15 bg-destructive/10 text-destructive',
                )}
              >
                <Icon className="size-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'text-sm leading-snug text-slate-900 dark:text-slate-100',
                    failed && 'text-destructive',
                  )}
                >
                  {title}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <PersonAvatar
                    src={activity.actorAvatarUrl}
                    name={actor}
                    className="size-4 border border-border/60"
                    fallbackClassName="text-[9px] font-semibold"
                  />
                  <span className="font-medium text-slate-600 dark:text-slate-300">{actor}</span>
                  <span aria-hidden>•</span>
                  <span>
                    {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                  </span>
                </p>
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
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center">
      <div className="flex size-11 items-center justify-center rounded-full border border-border/70 bg-background text-primary shadow-sm">
        <Activity className="size-5" aria-hidden />
      </div>
      <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">{text}</p>
    </div>
  );
}
