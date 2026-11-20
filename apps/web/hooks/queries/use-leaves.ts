'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  approveLeave,
  cancelLeave,
  createLeave,
  deleteLeave,
  fetchLeaveDashboardSummary,
  fetchLeaves,
  fetchMyLeaveBalances,
  fetchMyLeaves,
  rejectLeave,
  updateLeave,
} from '@/lib/api/leaves';
import { isTenantAdmin } from '@/lib/auth/manager-access';
import { queryKeys } from '@/lib/query/keys';
import {
  applyOptimisticUpdate,
  isLastInFlightMutation,
  patchListItem,
} from '@/lib/query/optimistic';
import type { CreateLeaveInput, LeaveRequest, UpdateLeaveInput } from '@/lib/schemas/leave';
import { useTenant } from '@/providers/tenant-provider';

import { invalidateLeaveMutationQueries } from './leave-mutation-invalidation';
import { useViewerHasDirectReports } from './use-direct-reports';
import { useEmployees } from './use-employees';

function useCanViewTeamLeaves() {
  const { tenant } = useTenant();
  const viewerHasDirectReports = useViewerHasDirectReports();
  return isTenantAdmin(tenant?.member?.role) || viewerHasDirectReports;
}

export function useLeaves(options?: { limit?: number }) {
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const canViewTeamLeaves = useCanViewTeamLeaves();

  return useQuery({
    queryKey: [
      ...queryKeys.leaves.all,
      tenantId,
      canViewTeamLeaves ? 'team' : 'self',
      options?.limit,
    ],
    queryFn: canViewTeamLeaves ? fetchLeaves : fetchMyLeaves,
    select: options?.limit ? (data) => data.slice(0, options.limit) : undefined,
    enabled: !tenantLoading && Boolean(tenantId),
    placeholderData: keepPreviousData,
  });
}

export function useLeaveDashboardSummary(today: string) {
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const canViewTeamLeaves = useCanViewTeamLeaves();

  // Under the leaves prefix, so approving, rejecting or filing leave refreshes it.
  return useQuery({
    queryKey: [
      ...queryKeys.leaves.all,
      tenantId,
      'dashboard-summary',
      canViewTeamLeaves ? 'team' : 'self',
      today,
    ],
    queryFn: () => fetchLeaveDashboardSummary(today),
    enabled: !tenantLoading && Boolean(tenantId),
    placeholderData: keepPreviousData,
  });
}

export function useLeaveBalances(options?: { enabled?: boolean }) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.leaves.balances, tenantId],
    queryFn: fetchMyLeaveBalances,
    enabled: (options?.enabled ?? true) && !tenantLoading && Boolean(tenantId),
  });
}

export function useCreateLeave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateLeaveInput) => createLeave(input),
    onSuccess: () => invalidateLeaveMutationQueries(queryClient),
  });
}

export function useUpdateLeave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leaveId, input }: { leaveId: string; input: UpdateLeaveInput }) =>
      updateLeave(leaveId, input),
    onSuccess: () => invalidateLeaveMutationQueries(queryClient),
  });
}

export function useDeleteLeave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (leaveId: string) => deleteLeave(leaveId),
    onSuccess: () => invalidateLeaveMutationQueries(queryClient),
  });
}

export function useCancelLeave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (leaveId: string) => cancelLeave(leaveId),
    onSuccess: () => invalidateLeaveMutationQueries(queryClient),
  });
}

function useLeaveDecisionMutation(
  decision: 'approved' | 'rejected',
  request: (input: { leaveId: string; comments?: string }) => Promise<void>,
) {
  const queryClient = useQueryClient();
  const mutationKey = ['leaves', 'decision'] as const;

  return useMutation({
    mutationKey,
    mutationFn: request,
    // Flip the row at once; balances and the calendar refresh once the server confirms.
    onMutate: async ({ leaveId }) => {
      const rollback = await applyOptimisticUpdate<unknown>(
        queryClient,
        queryKeys.leaves.all,
        (data) => patchListItem<LeaveRequest>(data, leaveId, { status: decision }),
      );
      return { rollback };
    },
    onError: (_error, _variables, context) => context?.rollback(),
    onSettled: () => {
      if (!isLastInFlightMutation(queryClient, mutationKey)) return;
      void invalidateLeaveMutationQueries(queryClient);
    },
  });
}

export function useApproveLeave() {
  return useLeaveDecisionMutation('approved', ({ leaveId, comments }) =>
    approveLeave(leaveId, comments),
  );
}

export function useRejectLeave() {
  return useLeaveDecisionMutation('rejected', ({ leaveId, comments }) =>
    rejectLeave(leaveId, comments),
  );
}

export function useLeaveApprovalContext() {
  const { tenant } = useTenant();
  const { data: employees = [] } = useEmployees();
  return {
    viewerMemberId: tenant?.member?.id,
    viewerRole: tenant?.member?.role,
    employees,
  };
}

export function useViewerIsAdminForLeaves() {
  const { tenant } = useTenant();
  return isTenantAdmin(tenant?.member?.role);
}
