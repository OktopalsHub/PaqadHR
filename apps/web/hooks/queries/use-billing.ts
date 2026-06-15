'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchBillingStatus } from '@/lib/api/subscriptions';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';

export function useBillingStatus() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: queryKeys.billing.status(tenantId ?? ''),
    queryFn: () => fetchBillingStatus(tenantId!),
    enabled: !tenantLoading && Boolean(tenantId),
  });
}
