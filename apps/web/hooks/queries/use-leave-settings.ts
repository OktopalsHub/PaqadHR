'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createLeaveType,
  deleteLeaveType,
  fetchLeaveTypes,
  updateLeaveType,
} from '@/lib/api/leave-types';
import { fetchLeavePolicy, updateLeavePolicy } from '@/lib/api/leave-policy';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';

export function useLeavePolicy() {
  const { tenantId, isLoading: tenantLoading } = useTenant();
  return useQuery({
    queryKey: [...queryKeys.settings.leavePolicy, tenantId],
    queryFn: fetchLeavePolicy,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useUpdateLeavePolicy() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: updateLeavePolicy,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.settings.leavePolicy, tenantId] });
    },
  });
}

export function useLeaveTypesAdmin() {
  const { tenantId, isLoading: tenantLoading } = useTenant();
  return useQuery({
    queryKey: [...queryKeys.settings.leaveTypes, tenantId],
    queryFn: fetchLeaveTypes,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useCreateLeaveType() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: createLeaveType,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.settings.leaveTypes, tenantId] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.leaves.all });
    },
  });
}

export function useUpdateLeaveType() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: ({ typeId, input }: { typeId: string; input: Parameters<typeof updateLeaveType>[1] }) =>
      updateLeaveType(typeId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.settings.leaveTypes, tenantId] });
    },
  });
}

export function useDeleteLeaveType() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: deleteLeaveType,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.settings.leaveTypes, tenantId] });
    },
  });
}
