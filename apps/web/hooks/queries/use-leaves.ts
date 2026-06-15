'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveLeave,
  createLeave,
  fetchLeaves,
  fetchMyLeaveBalances,
  rejectLeave,
} from '@/lib/api/leaves';
import { queryKeys } from '@/lib/query/keys';
import type { CreateLeaveInput } from '@/lib/schemas/leave';
import { useTenant } from '@/providers/tenant-provider';

export function useLeaves() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.leaves.all, tenantId],
    queryFn: fetchLeaves,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useLeaveBalances() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.leaves.balances, tenantId],
    queryFn: fetchMyLeaveBalances,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useCreateLeave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateLeaveInput) => createLeave(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.leaves.all });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.leaves.balances,
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.calendar.events,
      });
    },
  });
}

export function useApproveLeave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leaveId, comments }: { leaveId: string; comments?: string }) =>
      approveLeave(leaveId, comments),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.leaves.all });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.leaves.balances,
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.calendar.events,
      });
    },
  });
}

export function useRejectLeave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leaveId, comments }: { leaveId: string; comments?: string }) =>
      rejectLeave(leaveId, comments),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.leaves.all });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.leaves.balances,
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.calendar.events,
      });
    },
  });
}
