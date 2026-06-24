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
      <ContentCard title="Upcoming celebrations">
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
    <ContentCard title="Upcoming celebrations" description="Birthdays and work anniversaries">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No upcoming celebrations.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3"
            >
              <div className="flex items-center gap-2">
                {item.type === 'birthday' ? (
                  <Gift className="size-4 text-pink-500" />
                ) : (
                  <Calendar className="size-4 text-purple-500" />
                )}
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.date}</p>
                </div>
              </div>
              <Badge variant="outline">{item.type}</Badge>
            </div>
          ))}
        </div>
      )}
    </ContentCard>
  );
}
