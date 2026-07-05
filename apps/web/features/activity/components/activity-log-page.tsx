'use client';

import { useMemo, useState } from 'react';
import { AppPage } from '@/components/app-page';
import { LoadingBlock } from '@/components/loading-block';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTenantActivities } from '@/hooks/queries/use-activities';
import type { TenantActivity } from '@/lib/api/activities';
import { isTenantAdmin } from '@/lib/auth/manager-access';
import { useTenant } from '@/providers/tenant-provider';
import {
  type ActivityCategory,
  getActivityCategory,
  groupActivitiesByDay,
} from '../lib/activity-format';
import { ActivityLogItem } from './activity-log-item';

const FILTERS: Array<{ value: ActivityCategory; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'leave', label: 'Leave' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'rewards', label: 'Rewards' },
];

function filterActivities(items: TenantActivity[], category: ActivityCategory): TenantActivity[] {
  if (category === 'all') return items;
  return items.filter((item) => getActivityCategory(item) === category);
}

export function ActivityLogPage() {
  const { tenant } = useTenant();
  const [filter, setFilter] = useState<ActivityCategory>('all');
  const isAdmin = isTenantAdmin(tenant?.member?.role);

  const { data, isLoading, isError, refetch, isFetching } = useTenantActivities({
    enabled: isAdmin,
    limit: 100,
  });

  const items = useMemo(() => filterActivities(data?.items ?? [], filter), [data?.items, filter]);

  const groups = useMemo(() => groupActivitiesByDay(items), [items]);

  if (!isAdmin) {
    return (
      <AppPage>
        <Card>
          <CardHeader>
            <CardTitle>Logs</CardTitle>
            <CardDescription>
              Only workspace owners and admins can view the activity log.
            </CardDescription>
          </CardHeader>
        </Card>
      </AppPage>
    );
  }

  return (
    <AppPage>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Logs</h1>
          <p className="text-sm text-muted-foreground">
            Important workspace events — leave, payroll, rewards, and more.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="self-start sm:self-auto"
        >
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <Button
            key={option.value}
            variant={filter === option.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0 px-4 sm:px-6">
          {isLoading ? (
            <div className="py-12">
              <LoadingBlock />
            </div>
          ) : isError ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Unable to load activity. Try refreshing.
            </p>
          ) : groups.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No activity yet. Events like leave approvals, payroll runs, and reward redemptions
              will show up here.
            </p>
          ) : (
            groups.map((group) => (
              <section key={group.label} className="border-b border-border/60 last:border-b-0">
                <h2 className="sticky top-0 z-10 bg-card py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </h2>
                <div className="divide-y divide-border/60">
                  {group.items.map((activity) => (
                    <ActivityLogItem
                      key={activity.id}
                      activity={activity}
                      tenantSlug={tenant?.slug ?? ''}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </CardContent>
      </Card>
    </AppPage>
  );
}
