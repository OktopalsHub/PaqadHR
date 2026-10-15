'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type CreateLeaveBalanceInput,
  createLeaveBalance,
  deleteLeaveBalance,
  fetchLeaveBalanceById,
  fetchLeaveBalances,
  fetchMemberLeaveBalances,
  type UpdateLeaveBalanceInput,
  updateLeaveBalance,
} from '@/lib/api/leave-balances';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';

export function useLeaveBalancesAdmin() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.leaves.balances, 'admin', tenantId],
    queryFn: () => fetchLeaveBalances(tenantId!),
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useMemberLeaveBalancesAdmin(memberId: string, year?: number) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.leaves.balances, 'member', memberId, year, tenantId],
    queryFn: () => fetchMemberLeaveBalances(tenantId!, memberId, year),
    enabled: !tenantLoading && Boolean(tenantId) && Boolean(memberId),
  });
}

export function useLeaveBalanceAdmin(balanceId: string) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.leaves.balances, 'detail', balanceId, tenantId],
    queryFn: () => fetchLeaveBalanceById(tenantId!, balanceId),
    enabled: !tenantLoading && Boolean(tenantId) && Boolean(balanceId),
  });
}

export function useCreateLeaveBalanceAdmin() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: ({ leaveTypeId, input }: { leaveTypeId: string; input: CreateLeaveBalanceInput }) =>
      createLeaveBalance(tenantId!, leaveTypeId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.leaves.balances, 'admin', tenantId],
      });
    },
  });
}

export function useUpdateLeaveBalanceAdmin() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: ({ balanceId, input }: { balanceId: string; input: UpdateLeaveBalanceInput }) =>
      updateLeaveBalance(tenantId!, balanceId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.leaves.balances, 'admin', tenantId],
      });
    },
  });
}

export function useDeleteLeaveBalanceAdmin() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: (balanceId: string) => deleteLeaveBalance(tenantId!, balanceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.leaves.balances, 'admin', tenantId],
      });
    },
  });
}
