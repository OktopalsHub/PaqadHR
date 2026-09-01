'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelSubscription,
  createSubscriptionCheckout,
  fetchBillingOverview,
  fetchBillingStatus,
  resumeSubscription,
  startTrial,
  updatePaymentMethod,
} from '@/lib/api/subscriptions';
import { tenantUrl } from '@/lib/navigation/tenant-routes';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';

export function useBillingStatus() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: queryKeys.billing.status(tenantId ?? ''),
    queryFn: () => fetchBillingStatus(tenantId!),
    enabled: !tenantLoading && Boolean(tenantId),
    refetchOnWindowFocus: true,
  });
}

export function useBillingOverview() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: queryKeys.billing.overview(tenantId ?? ''),
    queryFn: () => fetchBillingOverview(tenantId!),
    enabled: !tenantLoading && Boolean(tenantId),
    refetchOnWindowFocus: true,
  });
}

function useInvalidateBilling() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  return () => {
    if (tenantId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.status(tenantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.overview(tenantId) });
    }
  };
}

export function useStartTrial() {
  const { tenantId } = useTenant();
  const invalidate = useInvalidateBilling();

  return useMutation({
    mutationFn: async (planSlug: string) => {
      if (!tenantId) throw new Error('Workspace not selected');
      return startTrial(tenantId, planSlug);
    },
    onSuccess: invalidate,
  });
}

export function useCreateSubscriptionCheckout() {
  const { tenantId, tenant } = useTenant();
  const invalidate = useInvalidateBilling();

  return useMutation({
    mutationFn: async ({ planSlug, successUrl }: { planSlug: string; successUrl?: string }) => {
      if (!tenantId || !tenant?.slug) {
        throw new Error('Workspace not selected');
      }

      const resolvedSuccessUrl =
        successUrl ??
        (tenant.slug ? tenantUrl(tenant.slug, '/settings?tab=billing&billing=success') : undefined);

      return createSubscriptionCheckout(tenantId, planSlug, resolvedSuccessUrl);
    },
    onSuccess: invalidate,
  });
}

export function useUpdatePaymentMethod() {
  const { tenantId, tenant } = useTenant();
  const invalidate = useInvalidateBilling();

  return useMutation({
    mutationFn: async () => {
      if (!tenantId || !tenant?.slug) {
        throw new Error('Workspace not selected');
      }
      const successUrl = tenant.slug
        ? tenantUrl(tenant.slug, '/settings?tab=billing&billing=card-updated')
        : undefined;
      return updatePaymentMethod(tenantId, successUrl);
    },
    onSuccess: (result) => {
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
      }
      invalidate();
    },
  });
}

export function useCancelSubscription() {
  const { tenantId } = useTenant();
  const invalidate = useInvalidateBilling();

  return useMutation({
    mutationFn: (options?: { atPeriodEnd?: boolean; reason?: string }) => {
      if (!tenantId) throw new Error('Workspace not selected');
      return cancelSubscription(tenantId, options);
    },
    onSuccess: invalidate,
  });
}

export function useResumeSubscription() {
  const { tenantId } = useTenant();
  const invalidate = useInvalidateBilling();

  return useMutation({
    mutationFn: () => {
      if (!tenantId) throw new Error('Workspace not selected');
      return resumeSubscription(tenantId);
    },
    onSuccess: invalidate,
  });
}
