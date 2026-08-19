'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  assignPoints,
  type ClaimInput,
  type CustomRewardInput,
  claimReward,
  completeWalletTopupCheckout,
  createCustomReward,
  createWalletTopupCheckout,
  deleteCustomReward,
  fetchAllClaims,
  fetchCustomRewards,
  fetchMyClaims,
  fetchNombaDataPlans,
  fetchReloadlyCountries,
  fetchRewardProviders,
  fetchRewardsCatalog,
  fetchTenantWallet,
  fetchTopupOperators,
  fetchUtilityBillers,
  fetchWalletTransactions,
  manualTopupWallet,
  type RewardRedemption,
  type UpdateCustomRewardInput,
  updateAutoTopupConfig,
  updateCustomReward,
} from '@/lib/api/rewards';
import { queryKeys } from '@/lib/query/keys';
import type { MemberPointsBalance } from '@/lib/schemas/member-points';
import { useTenant } from '@/providers/tenant-provider';

export function useNombaDataPlans(network: 'MTN' | 'AIRTEL' | 'GLO' | '9MOBILE', enabled = true) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: ['rewards-nomba-data-plans', tenantId, network],
    queryFn: () => fetchNombaDataPlans(network),
    enabled: !tenantLoading && Boolean(tenantId) && enabled,
  });
}

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

export function useRewardsCatalog(countryCode?: string) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.rewards.catalog, tenantId, countryCode ?? 'default'],
    queryFn: () => fetchRewardsCatalog(countryCode),
    enabled: !tenantLoading && Boolean(tenantId),
    staleTime: 60_000,
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

export function useRewardProviders() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: tenantId ? queryKeys.rewards.providers(tenantId) : ['rewards-providers'],
    queryFn: fetchRewardProviders,
    enabled: !tenantLoading && Boolean(tenantId),
    staleTime: 300_000,
  });
}

export function useClaimReward() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: (input: ClaimInput) => claimReward(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({
        queryKey: [...queryKeys.shoutouts.points(tenantId ?? '')],
      });

      const previousPoints = queryClient.getQueryData(queryKeys.shoutouts.points(tenantId ?? ''));

      // Optimistically deduct points
      queryClient.setQueryData(
        queryKeys.shoutouts.points(tenantId ?? ''),
        (old: MemberPointsBalance | undefined) => {
          if (!old) return old;
          return {
            ...old,
            currentBalance: Math.max(0, old.currentBalance - input.pointsCost),
          };
        },
      );

      return { previousPoints };
    },
    onError: (_err, _input, context) => {
      if (context?.previousPoints) {
        queryClient.setQueryData(
          queryKeys.shoutouts.points(tenantId ?? ''),
          context.previousPoints,
        );
      }
    },
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

export function useUpdateCustomReward() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ rewardId, input }: { rewardId: string; input: UpdateCustomRewardInput }) =>
      updateCustomReward(rewardId, input),
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
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: (amount: number) => {
      if (!tenantId) throw new Error('Workspace not selected');
      return manualTopupWallet(tenantId, amount);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.rewards.wallet });
    },
  });
}

const WALLET_TOPUP_PENDING_KEY = 'paqad.walletTopupPending';

export function useWalletTopupCheckout() {
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: (amount: number) => {
      if (!tenantId) throw new Error('Workspace not selected');
      return createWalletTopupCheckout(tenantId, amount);
    },
    onSuccess: (result, amount) => {
      if (result.checkoutUrl && tenantId) {
        try {
          sessionStorage.setItem(
            WALLET_TOPUP_PENDING_KEY,
            JSON.stringify({
              tenantId,
              orderReference: result.orderReference,
              transactionReference: result.transactionReference,
              amount,
            }),
          );
        } catch {
          // ignore storage failures — webhook may still credit
        }
        window.location.assign(result.checkoutUrl);
      }
    },
  });
}

export function useCompleteWalletTopupCheckout() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: (params: {
      orderReference: string;
      amount?: number;
      transactionReference?: string;
    }) => {
      if (!tenantId) throw new Error('Workspace not selected');
      return completeWalletTopupCheckout(
        tenantId,
        params.orderReference,
        params.amount,
        params.transactionReference,
      );
    },
    onSuccess: (result) => {
      if (result.credited) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.rewards.wallet });
        void queryClient.invalidateQueries({ queryKey: queryKeys.rewards.walletTransactions });
      }
    },
  });
}

export { WALLET_TOPUP_PENDING_KEY };

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
