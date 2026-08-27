'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type AssignPositionInput,
  assignPosition,
  type CreatePositionInput,
  createPosition,
  deletePosition,
  fetchPositionHistory,
  fetchPositions,
  restorePosition,
  type UpdatePositionInput,
  updatePosition,
} from '@/lib/api/positions';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';

export function usePositions() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.positions.all, tenantId],
    queryFn: fetchPositions,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function usePositionHistory(memberId?: string, enabled = true) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.employees.detail(memberId ?? ''), tenantId, 'position-history'],
    queryFn: () => fetchPositionHistory(memberId!),
    enabled: enabled && !tenantLoading && Boolean(tenantId && memberId),
  });
}

export function useAssignPosition(memberId: string) {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: (input: AssignPositionInput) => assignPosition(memberId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.employees.detail(memberId), tenantId, 'position-history'],
      });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.employees.detail(memberId), tenantId, 'member'],
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.employees.all,
      });
    },
  });
}

export function useCreatePosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePositionInput) => createPosition(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.positions.all });
    },
  });
}

export function useUpdatePosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePositionInput }) =>
      updatePosition(id, input),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.positions.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.employees.all }),
      ]);
    },
  });
}

export function useDeletePosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deletePosition(id),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.positions.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.employees.all }),
      ]);
    },
  });
}

export function useRestorePosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => restorePosition(id),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.positions.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.employees.all }),
      ]);
    },
  });
}
