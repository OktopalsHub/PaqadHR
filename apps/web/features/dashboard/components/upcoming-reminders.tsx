'use client';

import { useQuery } from '@tanstack/react-query';
import { Calendar, Gift } from 'lucide-react';
import { ContentCard } from '@/components/content-card';
import { LoadingBlock } from '@/components/loading-block';
import { Badge } from '@/components/ui/badge';
import { apiClient, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';

type ApiCelebration = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
  type: 'birthday' | 'anniversary';
  date: string;
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
        headerClassName="border-b border-[#d7e3f6] px-5 py-4"
        titleClassName="text-[17px] font-semibold text-slate-950"
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
    const label = item.type === 'birthday' ? 'Birthday' : 'Anniversary';
    const date = typeof item.date === 'string' ? item.date.slice(0, 10) : '';
    return { id: item.id, title: `${name} — ${label}`, date, type: item.type };
  });

  return (
    <ContentCard
      title="Upcoming celebrations"
      description="Birthdays and work anniversaries"
      className="dashboard-panel rounded-[8px]"
      headerClassName="border-b border-[#d7e3f6] px-5 py-4"
      titleClassName="text-[17px] font-semibold text-slate-950"
      descriptionClassName="text-sm text-slate-600"
      bodyClassName="p-5"
    >
      {items.length === 0 ? (
        <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 text-center text-slate-500">
          <Gift className="size-10 text-slate-400" />
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
                <div className="flex size-10 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
                  {item.type === 'birthday' ? (
                    <Gift className="size-4 text-[#dd6b20]" />
                  ) : (
                    <Calendar className="size-4 text-[#35598e]" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-600">{item.date}</p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="self-start rounded-full border-[#cad7ee] bg-white/70 px-2.5 py-1 text-[11px] capitalize text-slate-600 sm:self-auto"
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
