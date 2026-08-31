'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelSubscription,
  createSubscriptionCheckout,
  fetchBillingOverview,
  fetchBillingStatus,
  resumeSubscription,
  startTrial,
  updatePaymentMethod,
} from '@/lib/api/subscriptions';
import { getCachedBillingOverview } from '@/lib/api/subscriptions';
import { tenantUrl } from '@/lib/navigation/tenant-routes';
import { queryKeys } from '@/lib/query/keys';
import type { BillingOverview } from '@/lib/schemas/subscription';
import { useTenant } from '@/providers/tenant-provider';

export function billingOverviewQueryOptions(tenantId: string) {
  return {
    queryKey: queryKeys.billing.overview(tenantId),
    queryFn: () => fetchBillingOverview(tenantId),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  } as const;
}

export function billingStatusQueryOptions(tenantId: string) {
  return {
    queryKey: queryKeys.billing.status(tenantId),
    queryFn: () => fetchBillingStatus(tenantId),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  } as const;
}

export function useBillingStatus() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    ...billingStatusQueryOptions(tenantId ?? ''),
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useBillingOverview() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    ...billingOverviewQueryOptions(tenantId ?? ''),
    enabled: !tenantLoading && Boolean(tenantId),
    // Hybrid cache — instant paint on reload, survives tab refresh (sessionStorage 5m)
    // Background refetch keeps data fresh while cached value paints instantly.
    initialData: () => {
      if (!tenantId) return undefined;
      return getCachedBillingOverview(tenantId) ?? undefined;
    },
    initialDataUpdatedAt: () => 0,
  });
}

// Lightweight prefetch helper for hover/intent — no waterfall, uses same options
export function usePrefetchBillingOverview() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  return () => {
    if (!tenantId) return;
    void queryClient.prefetchQuery(billingOverviewQueryOptions(tenantId));
  };
}

function useInvalidateBilling() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  return () => {
    if (tenantId) {
      // Single prefix invalidation covers both status & overview (queryKeys.billing.* share ['billing', tenantId] prefix)
      void queryClient.invalidateQueries({ queryKey: queryKeys.billing.status(tenantId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.billing.overview(tenantId) });
    }
  };
}

export function useStartTrial() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const invalidate = useInvalidateBilling();

  return useMutation({
    mutationFn: async (planSlug: string) => {
      if (!tenantId) throw new Error('Workspace not selected');
      return startTrial(tenantId, planSlug);
    },
    onMutate: async (planSlug) => {
      if (!tenantId) return;
      await queryClient.cancelQueries({ queryKey: queryKeys.billing.overview(tenantId) });
      const previous = queryClient.getQueryData<BillingOverview>(
        queryKeys.billing.overview(tenantId),
      );
      if (previous) {
        const now = new Date();
        const trialEndsAt = new Date(now);
        trialEndsAt.setDate(trialEndsAt.getDate() + 14);
        queryClient.setQueryData<BillingOverview>(queryKeys.billing.overview(tenantId), {
          ...previous,
          trialEligible: false,
          entitled: true,
          needsPayment: false,
          subscription: {
            status: 'TRIAL',
            plan: planSlug,
            trialEndsAt: trialEndsAt.toISOString(),
            isOnTrial: true,
            daysRemaining: 14,
            currentPeriodEnd: trialEndsAt.toISOString(),
            nextBillingDate: trialEndsAt.toISOString(),
          } as BillingOverview['subscription'],
        });
      }
      return { previous };
    },
    onError: (_err, _planSlug, context) => {
      if (context?.previous && tenantId) {
        queryClient.setQueryData(queryKeys.billing.overview(tenantId), context.previous);
      }
    },
    onSettled: invalidate,
  });
}

export function useCreateSubscriptionCheckout() {
  const { tenantId, tenant } = useTenant();
  const queryClient = useQueryClient();
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
    // Checkout redirects externally — don't block on refetch. Fire-and-forget invalidate.
    onSuccess: () => {
      if (tenantId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.billing.overview(tenantId) });
      }
      invalidate();
    },
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
