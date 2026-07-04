'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchTenantActivities } from '@/lib/api/activities';
import { useTenant } from '@/providers/tenant-provider';

export function useTenantActivities(params?: {
  page?: number;
  limit?: number;
  resourceType?: string;
}) {
  const { tenant } = useTenant();
  return useQuery({
    queryKey: ['tenant-activities', tenant?.id, params],
    queryFn: () => fetchTenantActivities(params),
    enabled: Boolean(tenant?.id),
  });
}
