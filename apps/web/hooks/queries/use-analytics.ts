'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchAnalyticsOverview } from '@/lib/api/analytics';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';

export function useAnalyticsOverview() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.analytics.overview, tenantId],
    queryFn: fetchAnalyticsOverview,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}
