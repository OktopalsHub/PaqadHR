'use client';

import { Activity, Loader2, ShieldAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AppPage } from '@/components/app-page';
import { ContentCard } from '@/components/content-card';
import { LoadingBlock } from '@/components/loading-block';
import { Button } from '@/components/ui/button';
import { LeavePagination } from '@/features/leaves/components/leave-pagination';
import { useTenantActivities } from '@/hooks/queries/use-activities';
import type { TenantActivity } from '@/lib/api/activities';
import { isTenantAdmin } from '@/lib/auth/manager-access';
import { cn } from '@/lib/utils';
import { useTenant } from '@/providers/tenant-provider';
import {
  type ActivityCategory,
  getActivityCategory,
  groupActivitiesByDay,
} from '../lib/activity-format';
import { ActivityDetailDialog } from './activity-detail-dialog';
import { ActivityLogItem } from './activity-log-item';

const PAGE_SIZE = 20;

const FILTERS: Array<{ value: ActivityCategory; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'leave', label: 'Leave' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'rewards', label: 'Rewards' },
  { value: 'shoutouts', label: 'Shoutouts' },
  { value: 'settings', label: 'Settings' },
  { value: 'org', label: 'People & org' },
];

const CATEGORY_RESOURCE_TYPE: Partial<Record<ActivityCategory, string>> = {
  leave: 'leave',
  payroll: 'payroll',
  settings: 'settings',
  shoutouts: 'shoutout',
};

function filterActivities(items: TenantActivity[], category: ActivityCategory): TenantActivity[] {
  if (category === 'all') return items;
  if (CATEGORY_RESOURCE_TYPE[category]) return items;
  return items.filter((item) => getActivityCategory(item) === category);
}

export function ActivityLogPage() {
  const { tenant } = useTenant();
  const [filter, setFilter] = useState<ActivityCategory>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<TenantActivity | null>(null);
  const isAdmin = isTenantAdmin(tenant?.member?.role);

  const resourceType = CATEGORY_RESOURCE_TYPE[filter];
  const { data, isLoading, isError, refetch, isFetching } = useTenantActivities({
    enabled: isAdmin,
    page,
    limit: PAGE_SIZE,
    resourceType,
  });

  const items = useMemo(() => filterActivities(data?.items ?? [], filter), [data?.items, filter]);
  const groups = useMemo(() => groupActivitiesByDay(items), [items]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleFilterChange = (next: ActivityCategory) => {
    setFilter(next);
    setPage(1);
  };

  if (!isAdmin) {
    return (
      <AppPage className="space-y-6">
        <div>
          <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.035em] text-slate-950 dark:text-slate-50">
            Activity
          </h1>
        </div>

        <ContentCard
          title="Restricted access"
          description="Only workspace owners and admins can view the activity log."
          className="dashboard-panel rounded-[8px]"
          bodyClassName="p-5"
        >
          <div className="dashboard-soft-tile flex min-h-45 flex-col items-center justify-center rounded-[8px] border border-dashed border-[#d7e3f6] px-6 py-8 text-center dark:border-slate-700">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full border border-border/70 bg-background text-primary shadow-sm">
              <ShieldAlert className="size-5" />
            </div>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Admin access required
            </p>
            <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
              Ask a workspace owner or admin to grant access if you need to review the activity
              feed.
            </p>
          </div>
        </ContentCard>
      </AppPage>
    );
  }

  return (
    <AppPage className="space-y-6">
      <ContentCard
        className="dashboard-panel rounded-[8px]"
        headerClassName="border-b border-[#d7e3f6] px-5 py-4 dark:border-slate-800"
        action={
          <div className="flex w-full flex-col gap-4 xl:flex-row xl:items-center">
            <div className="overflow-x-auto pb-1">
              <div className="inline-flex min-w-max flex-nowrap items-center rounded-[8px] border border-slate-100 bg-white p-1 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] dark:border-slate-800 dark:bg-slate-950/75 dark:shadow-none">
                {FILTERS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleFilterChange(option.value)}
                    className={cn(
                      'cursor-pointer rounded-[8px] px-5 py-2 text-sm whitespace-nowrap transition-colors',
                      filter === option.value
                        ? 'bg-primary text-primary-foreground shadow-sm font-semibold'
                        : 'font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:ml-auto xl:justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refetch()}
                disabled={isFetching}
                className="h-10 w-full rounded-[8px] px-4 sm:w-auto"
              >
                {isFetching ? <Loader2 className="size-4 animate-spin" /> : null}
                Refresh
              </Button>
            </div>
          </div>
        }
        bodyClassName="space-y-5 p-5"
      >
        <div className="space-y-5">
          {isLoading ? (
            <div className="py-12">
              <LoadingBlock />
            </div>
          ) : isError ? (
            <div className="dashboard-soft-tile flex min-h-55 items-center justify-center rounded-[8px] border border-dashed border-[#d7e3f6] px-6 py-8 text-center dark:border-slate-700">
              <div>
                <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Unable to load activity
                </p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Try refreshing the feed to fetch the latest workspace events.
                </p>
              </div>
            </div>
          ) : groups.length === 0 ? (
            <div className="flex min-h-70 flex-col items-center justify-center rounded-[8px] border border-dashed border-[#d7e3f6] bg-white px-6 py-8 text-center dark:border-slate-700 dark:bg-slate-950/70">
              <div className="mb-4 flex size-12 items-center justify-center rounded-full border border-border/70 bg-background text-primary shadow-sm">
                <Activity className="size-5" />
              </div>
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                No activity yet
              </p>
              <p className="mt-2 max-w-lg text-sm text-slate-500 dark:text-slate-400">
                Events like leave approvals, payroll runs, reward redemptions, and settings updates
                will appear here.
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.label} className="space-y-3">
                <div className="flex items-center gap-3">
                  <h2 className="dashboard-outline-label text-[11px] font-semibold uppercase">
                    {group.label}
                  </h2>
                  <div className="h-px flex-1 bg-border/70" />
                </div>
                <div className="space-y-2">
                  {group.items.map((activity) => (
                    <ActivityLogItem key={activity.id} activity={activity} onSelect={setSelected} />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>

        {!isLoading && !isError && total > 0 ? (
          totalPages > 1 ? (
            <LeavePagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          ) : (
            <p className="border-t border-border/70 pt-4 text-sm text-slate-500 dark:text-slate-400">
              Showing {total} event{total === 1 ? '' : 's'}
            </p>
          )
        ) : null}
      </ContentCard>

      <ActivityDetailDialog
        activity={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </AppPage>
  );
}
