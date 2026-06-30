'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  assignPoints,
  type ClaimInput,
  type CustomRewardInput,
  claimReward,
  createCustomReward,
  deleteCustomReward,
  fetchAllClaims,
  fetchCustomRewards,
  fetchMyClaims,
  fetchReloadlyCountries,
  fetchRewardsCatalog,
  fetchTenantWallet,
  fetchTopupOperators,
  fetchUtilityBillers,
  manualTopupWallet,
  updateAutoTopupConfig,
} from '@/lib/api/rewards';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';

export function useTopupOperators(countryCode: string) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: ['rewards-topup-operators', tenantId, countryCode],
    queryFn: () => fetchTopupOperators(countryCode),
    enabled: !tenantLoading && Boolean(tenantId) && Boolean(countryCode),
  });
}

export function useUtilityBillers(countryCode: string) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: ['rewards-utility-billers', tenantId, countryCode],
    queryFn: () => fetchUtilityBillers(countryCode),
    enabled: !tenantLoading && Boolean(tenantId) && Boolean(countryCode),
  });
}

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

export function useManualTopupWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) => manualTopupWallet(amount),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.rewards.wallet });
    },
  });
}

export function useUpdateAutoTopupConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { enabled: boolean; threshold: number; amount: number }) =>
      updateAutoTopupConfig(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.rewards.wallet });
    },
  });
}

export function useAssignPoints() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: (params: {
      memberIds: string[];
      points: number;
      reason?: string;
      assignments?: { memberId: string; points: number }[];
    }) => assignPoints(params),
    onSuccess: () => {
      if (tenantId) {
        void queryClient.invalidateQueries({
          queryKey: [...queryKeys.settings.membersPoints, tenantId],
        });
        void queryClient.invalidateQueries({ queryKey: queryKeys.shoutouts.points(tenantId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.shoutouts.all });
      }
    },
  });
}
