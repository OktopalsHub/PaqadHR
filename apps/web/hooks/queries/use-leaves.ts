'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveLeave,
  createLeave,
  deleteLeave,
  fetchLeaves,
  fetchMyLeaveBalances,
  fetchMyLeaves,
  rejectLeave,
  updateLeave,
} from '@/lib/api/leaves';
import { hasDirectReports, isTenantAdmin } from '@/lib/auth/manager-access';
import { queryKeys } from '@/lib/query/keys';
import type { CreateLeaveInput, UpdateLeaveInput } from '@/lib/schemas/leave';
import { useTenant } from '@/providers/tenant-provider';
import { useEmployees } from './use-employees';

function useCanViewTeamLeaves() {
  const { tenant } = useTenant();
  const { data: employees = [] } = useEmployees();
  const role = tenant?.member?.role;
  const viewerId = tenant?.member?.id;

  if (isTenantAdmin(role)) {
    return true;
  }
  if (!viewerId) {
    return false;
  }
  return hasDirectReports(viewerId, employees);
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.leaves.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.leaves.balances }),
        queryClient.invalidateQueries({ queryKey: queryKeys.calendar.events }),
      ]);
    },
  });
}

export function useUpdateLeave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leaveId, input }: { leaveId: string; input: UpdateLeaveInput }) =>
      updateLeave(leaveId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.leaves.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.calendar.events });
    },
  });
}

export function useDeleteLeave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (leaveId: string) => deleteLeave(leaveId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.leaves.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.calendar.events });
    },
  });
}

export function useApproveLeave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leaveId, comments }: { leaveId: string; comments?: string }) =>
      approveLeave(leaveId, comments),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.leaves.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.leaves.balances }),
        queryClient.invalidateQueries({ queryKey: queryKeys.calendar.events }),
      ]);
    },
  });
}

export function useRejectLeave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leaveId, comments }: { leaveId: string; comments?: string }) =>
      rejectLeave(leaveId, comments),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.leaves.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.leaves.balances }),
        queryClient.invalidateQueries({ queryKey: queryKeys.calendar.events }),
      ]);
    },
  });
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
