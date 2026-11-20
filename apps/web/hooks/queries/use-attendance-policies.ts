'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type CreateAttendancePolicyInput,
  createAttendancePolicy,
  deleteAttendancePolicy,
  fetchAttendancePolicies,
  type UpdateAttendancePolicyInput,
  updateAttendancePolicy,
} from '@/lib/api/attendance-policies';
import { queryKeys } from '@/lib/query/keys';
import { REFERENCE_DATA_STALE_MS } from '@/lib/query/stale-times';
import { useTenant } from '@/providers/tenant-provider';

export function useAttendancePolicies() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.attendance.policies, tenantId],
    staleTime: REFERENCE_DATA_STALE_MS,
    queryFn: fetchAttendancePolicies,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useCreateAttendancePolicy() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: (input: CreateAttendancePolicyInput) => createAttendancePolicy(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.attendance.policies, tenantId],
      });
    },
  });
}

export function useUpdateAttendancePolicy() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: ({ policyId, input }: { policyId: string; input: UpdateAttendancePolicyInput }) =>
      updateAttendancePolicy(policyId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.attendance.policies, tenantId],
      });
    },
  });
}

export function useDeleteAttendancePolicy() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: (policyId: string) => deleteAttendancePolicy(policyId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.attendance.policies, tenantId],
      });
    },
  });
}
