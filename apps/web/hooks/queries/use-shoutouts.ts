'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMyPointsBalance } from '@/lib/api/member-points';
import { createShoutout, fetchShoutoutCategories, fetchShoutouts } from '@/lib/api/shoutouts';
import { queryKeys } from '@/lib/query/keys';
import type { MemberPointsBalance } from '@/lib/schemas/member-points';
import type { CreateShoutoutInput, Shoutout, ShoutoutFeed } from '@/lib/schemas/shoutout';
import { useAuth } from '@/providers/auth-provider';
import { useTenant } from '@/providers/tenant-provider';

export function useShoutouts() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.shoutouts.all, tenantId],
    queryFn: () => fetchShoutouts({ limit: 50 }),
    enabled: !tenantLoading && Boolean(tenantId),
    staleTime: 30_000,
  });
}

export function useShoutoutCategories() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.shoutouts.categories, tenantId],
    queryFn: fetchShoutoutCategories,
    enabled: !tenantLoading && Boolean(tenantId),
    staleTime: 60_000,
  });
}

export function useCreateShoutout() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (input: CreateShoutoutInput) => createShoutout(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: [...queryKeys.shoutouts.all, tenantId] });
      await queryClient.cancelQueries({ queryKey: queryKeys.shoutouts.points(tenantId ?? '') });

      const previousFeed = queryClient.getQueryData<ShoutoutFeed>([
        ...queryKeys.shoutouts.all,
        tenantId,
      ]);
      const previousPoints = queryClient.getQueryData<MemberPointsBalance>(
        queryKeys.shoutouts.points(tenantId ?? ''),
      );

      const currentUserId = user?.id ?? '';
      const totalPoints = input.recipients.reduce((sum, r) => sum + r.points, 0);

      const optimisticShoutout: Shoutout = {
        id: `optimistic-${Date.now()}`,
        message: input.message,
        totalPoints,
        createdAt: new Date().toISOString(),
        sender: { id: currentUserId },
        recipients: input.recipients.map((r) => ({
          id: r.recipientId,
          points: r.points,
        })),
        categories: [],
      };

      if (previousFeed) {
        const records =
          previousFeed.records ??
          previousFeed.data ??
          previousFeed.items ??
          previousFeed.shoutouts ??
          [];
        queryClient.setQueryData<ShoutoutFeed>([...queryKeys.shoutouts.all, tenantId], {
          ...previousFeed,
          records: [optimisticShoutout, ...records],
        });
      }

      if (previousPoints) {
        queryClient.setQueryData<MemberPointsBalance>(queryKeys.shoutouts.points(tenantId ?? ''), {
          ...previousPoints,
          remainingAllowance: Math.max(0, previousPoints.remainingAllowance - totalPoints),
          totalGiven: previousPoints.totalGiven + totalPoints,
          monthlyGiven: previousPoints.monthlyGiven + totalPoints,
        });
      }

      return { previousFeed, previousPoints };
    },
    onError: (_err, _input, context) => {
      if (context?.previousFeed) {
        queryClient.setQueryData([...queryKeys.shoutouts.all, tenantId], context.previousFeed);
      }
      if (context?.previousPoints) {
        queryClient.setQueryData(
          queryKeys.shoutouts.points(tenantId ?? ''),
          context.previousPoints,
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.shoutouts.all, tenantId],
      });
      if (tenantId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.shoutouts.points(tenantId),
        });
      }
    },
  });
}

export function useMyPointsBalance() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: queryKeys.shoutouts.points(tenantId ?? ''),
    queryFn: fetchMyPointsBalance,
    enabled: !tenantLoading && Boolean(tenantId),
    staleTime: 30_000,
  });
}
