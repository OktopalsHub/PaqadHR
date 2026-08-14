'use client';

import { useQuery } from '@tanstack/react-query';
import { Calendar, Gift } from 'lucide-react';
import { ContentCard } from '@/components/content-card';
import { LoadingBlock } from '@/components/loading-block';
import { Badge } from '@/components/ui/badge';
import { apiClient, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';
import { formatOrdinal } from '@/lib/format-ordinal';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';

type ApiCelebration = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
  type: 'birthday' | 'anniversary';
  date: string;
  years?: number;
};

async function fetchCelebrations(): Promise<ApiCelebration[]> {
  const tenantId = await resolveTenantId();
  return apiClient<ApiCelebration[]>(tenantPath(tenantId, 'celebrations'));
}

export function UpcomingReminders() {
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const { data = [], isLoading } = useQuery({
    queryKey: [...queryKeys.calendar.events, 'celebrations', tenantId],
    queryFn: fetchCelebrations,
    enabled: !tenantLoading && Boolean(tenantId),
  });

  if (isLoading) {
    return (
      <ContentCard
        title="Upcoming celebrations"
        className="dashboard-panel rounded-[8px]"
        headerClassName="border-b border-border/60 px-5 py-4"
        titleClassName="text-[17px] font-semibold text-foreground"
      >
        <LoadingBlock />
      </ContentCard>
    );
  }

  const items = data.slice(0, 6).map((item) => {
    const name =
      item.preferredName?.trim() ||
      [item.firstName, item.lastName].filter(Boolean).join(' ') ||
      'Team member';
    const label =
      item.type === 'birthday'
        ? 'Birthday'
        : item.years && item.years >= 1
          ? `${formatOrdinal(item.years)} anniversary`
          : 'Anniversary';
    const date = typeof item.date === 'string' ? item.date.slice(0, 10) : '';
    return { id: item.id, title: `${name} — ${label}`, date, type: item.type };
  });

  return (
    <ContentCard
      title="Upcoming celebrations"
      className="dashboard-panel rounded-[8px]"
      headerClassName="border-b border-border/60 px-5 py-4"
      titleClassName="text-[17px] font-semibold text-foreground"
      bodyClassName="p-5"
    >
      {items.length === 0 ? (
        <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
          <Gift className="size-10 text-muted-foreground" />
          <p className="text-sm">No upcoming celebrations.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="dashboard-soft-tile flex flex-col gap-3 rounded-[8px] p-3.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-2">
                <div className="flex size-10 items-center justify-center rounded-2xl border border-border/60 bg-background/70 shadow-sm">
                  {item.type === 'birthday' ? (
                    <Gift className="size-4 text-warning" />
                  ) : (
                    <Calendar className="size-4 text-info" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.date}</p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="self-start rounded-full border-border/60 bg-background/70 px-2.5 py-1 text-[11px] capitalize text-muted-foreground sm:self-auto"
              >
                {item.type}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </ContentCard>
  );
}
