'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  assignExistingLeaveTypes,
  assignLeaveTypeToAllUsers,
  fetchAssignmentReport,
  removeLeaveTypeAssignments,
  syncLeaveTypeAssignments,
} from '@/lib/api/leave-assignments';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';

export function useAssignmentReport(year?: number) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.leaves.assignments, 'report', year, tenantId],
    queryFn: () => fetchAssignmentReport(tenantId!, year),
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useSyncLeaveTypeAssignments() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: (year?: number) => syncLeaveTypeAssignments(tenantId!, year),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.leaves.assignments],
      });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.leaves.balances],
      });
    },
  });
}

export function useAssignExistingLeaveTypes() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: (year?: number) => assignExistingLeaveTypes(tenantId!, year),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.leaves.assignments],
      });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.leaves.balances],
      });
    },
  });
}

export function useAssignLeaveTypeToAllUsers() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: ({ leaveTypeId, year }: { leaveTypeId: string; year?: number }) =>
      assignLeaveTypeToAllUsers(tenantId!, leaveTypeId, year),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.leaves.assignments],
      });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.leaves.balances],
      });
    },
  });
}

export function useRemoveLeaveTypeAssignments() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: ({ leaveTypeId, year }: { leaveTypeId: string; year?: number }) =>
      removeLeaveTypeAssignments(tenantId!, leaveTypeId, year),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.leaves.assignments],
      });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.leaves.balances],
      });
    },
  });
}
