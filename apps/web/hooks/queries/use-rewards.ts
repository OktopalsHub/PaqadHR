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
  fetchWalletTransactions,
  manualTopupWallet,
  provisionVirtualAccount,
  type RewardRedemption,
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
    refetchInterval: (query) => {
      const claims = query.state.data as RewardRedemption[] | undefined;
      const hasPending = claims?.some((c) => c.status === 'PENDING');
      return hasPending ? 5000 : false;
    },
  });
}

export function useAllClaims() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.rewards.allClaims, tenantId],
    queryFn: fetchAllClaims,
    enabled: !tenantLoading && Boolean(tenantId),
    refetchInterval: (query) => {
      const claims = query.state.data as RewardRedemption[] | undefined;
      const hasPending = claims?.some((c) => c.status === 'PENDING');
      return hasPending ? 5000 : false;
    },
  });
}

export function useTenantWallet() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.rewards.wallet, tenantId],
    queryFn: fetchTenantWallet,
    enabled: !tenantLoading && Boolean(tenantId),
    refetchInterval: (query) => {
      const w = query.state.data as { virtualAccountStatus?: string } | undefined;
      return w?.virtualAccountStatus === 'PROVISIONING' ? 3000 : false;
    },
  });
}

export function useWalletTransactions() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.rewards.walletTransactions, tenantId],
    queryFn: fetchWalletTransactions,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useProvisionVirtualAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => provisionVirtualAccount(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.rewards.wallet });
    },
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
