'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  claimReward,
  createCustomReward,
  deleteCustomReward,
  fetchAllClaims,
  fetchCustomRewards,
  fetchMyClaims,
  fetchRewardsCatalog,
  fetchTenantWallet,
  fetchReloadlyCountries,
  type ClaimInput,
  type CustomRewardInput,
} from '@/lib/api/rewards';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';

export function useRewardsCatalog() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.rewards.catalog, tenantId],
    queryFn: fetchRewardsCatalog,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useMyClaims() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.rewards.claims, tenantId],
    queryFn: fetchMyClaims,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useAllClaims() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.rewards.allClaims, tenantId],
    queryFn: fetchAllClaims,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useTenantWallet() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.rewards.wallet, tenantId],
    queryFn: fetchTenantWallet,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useCustomRewards() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.rewards.custom, tenantId],
    queryFn: fetchCustomRewards,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useReloadlyCountries() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: ['rewards-countries', tenantId],
    queryFn: fetchReloadlyCountries,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useClaimReward() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: (input: ClaimInput) => claimReward(input),
    onSuccess: () => {
      if (tenantId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.rewards.claims });
        void queryClient.invalidateQueries({ queryKey: queryKeys.shoutouts.points(tenantId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.rewards.wallet });
      }
    },
  });
}

export function useCreateCustomReward() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CustomRewardInput) => createCustomReward(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.rewards.custom });
      void queryClient.invalidateQueries({ queryKey: queryKeys.rewards.catalog });
    },
  });
}

export function useDeleteCustomReward() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rewardId: string) => deleteCustomReward(rewardId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.rewards.custom });
      void queryClient.invalidateQueries({ queryKey: queryKeys.rewards.catalog });
    },
  });
}
