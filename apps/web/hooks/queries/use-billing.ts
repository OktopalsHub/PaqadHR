'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createSubscriptionCheckout,
  fetchBillingOverview,
  fetchBillingStatus,
} from '@/lib/api/subscriptions';
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

export function useBillingOverview() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: queryKeys.billing.overview(tenantId ?? ''),
    queryFn: () => fetchBillingOverview(tenantId!),
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useCreateSubscriptionCheckout() {
  const { tenantId, tenant } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (planSlug: string) => {
      if (!tenantId || !tenant?.slug) {
        throw new Error('Workspace not selected');
      }

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const successUrl = origin
        ? `${origin}/${tenant.slug}/settings?tab=billing&billing=success`
        : undefined;

      return createSubscriptionCheckout(tenantId, planSlug, successUrl);
    },
    onSuccess: () => {
      if (tenantId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.billing.status(tenantId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.billing.overview(tenantId) });
      }
    },
  });
}
