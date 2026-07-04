'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchTenantActivities } from '@/lib/api/activities';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';

export function useTenantActivities(params?: {
  page?: number;
  limit?: number;
  resourceType?: string;
  enabled?: boolean;
}) {
  const { tenant } = useTenant();
  const { enabled = true, ...queryParams } = params ?? {};

  return useQuery({
    queryKey: [...queryKeys.activities.list(tenant?.id ?? ''), queryParams],
    queryFn: () => fetchTenantActivities(queryParams),
    enabled: Boolean(tenant?.id) && enabled,
    staleTime: 30_000,
  });
}
