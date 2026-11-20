'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { celebrationsQueryKey, fetchCalendarEvents, fetchCelebrations } from '@/lib/api/calendar';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';

import { getCalendarEventsQueryEnabled } from './calendar-query-enabled';

export function useCalendarEvents(options?: {
  enabled?: boolean;
  dateRange?: { from: string; to: string };
}) {
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: [...queryKeys.calendar.events, tenantId, options?.dateRange],
    queryFn: () =>
      fetchCalendarEvents(options?.dateRange, {
        // Shares one cached request with the dashboard's celebrations widget.
        celebrations: () =>
          queryClient.fetchQuery({
            queryKey: celebrationsQueryKey(tenantId),
            queryFn: fetchCelebrations,
            staleTime: 30_000,
          }),
      }),
    enabled: getCalendarEventsQueryEnabled({
      enabled: options?.enabled,
      tenantId,
      tenantLoading,
    }),
  });
}
