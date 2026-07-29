'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchCalendarEvents } from '@/lib/api/calendar';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';
import { getCalendarEventsQueryEnabled } from './calendar-query-enabled';

export function useCalendarEvents(options?: { enabled?: boolean }) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.calendar.events, tenantId],
    queryFn: fetchCalendarEvents,
    enabled: getCalendarEventsQueryEnabled({
      enabled: options?.enabled,
      tenantId,
      tenantLoading,
    }),
  });
}
