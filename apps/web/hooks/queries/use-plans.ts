'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  detectPlans,
  fetchAdminPlanPrices,
  fetchAdminPlans,
  fetchPlans,
  fetchPlansForCountry,
  type PlanPrice,
  updatePlanPrice,
  upsertPlanPrice,
} from '@/lib/api/plans';
import { queryKeys } from '@/lib/query/keys';

export function usePlans() {
  return useQuery({
    queryKey: queryKeys.plans.all,
    queryFn: fetchPlans,
  });
}

export function useDetectPlans() {
  return useQuery({
    queryKey: queryKeys.plans.detect,
    queryFn: detectPlans,
  });
}

export function usePlansForCountry(countryCode: string) {
  return useQuery({
    queryKey: queryKeys.plans.country(countryCode),
    queryFn: () => fetchPlansForCountry(countryCode),
    enabled: Boolean(countryCode),
  });
}

export function useAdminPlans() {
  return useQuery({
    queryKey: queryKeys.plans.admin,
    queryFn: fetchAdminPlans,
  });
}

export function useAdminPlanPrices(countryCode?: string) {
  return useQuery({
    queryKey: queryKeys.plans.prices(countryCode ?? ''),
    queryFn: () => fetchAdminPlanPrices(countryCode),
  });
}

export function useUpsertPlanPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Parameters<typeof upsertPlanPrice>[0]) => upsertPlanPrice(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.plans.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.plans.admin });
      void queryClient.invalidateQueries({ queryKey: ['plans', 'prices'] });
    },
  });
}

export function useUpdatePlanPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      priceId,
      updates,
    }: {
      priceId: string;
      updates: Partial<Omit<PlanPrice, 'id'>>;
    }) => updatePlanPrice(priceId, updates),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.plans.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.plans.admin });
      void queryClient.invalidateQueries({ queryKey: ['plans', 'prices'] });
    },
  });
}
