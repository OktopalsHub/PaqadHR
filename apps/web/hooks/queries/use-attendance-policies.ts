'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAttendancePolicy,
  deleteAttendancePolicy,
  fetchAttendancePolicies,
  updateAttendancePolicy,
  type CreateAttendancePolicyInput,
  type UpdateAttendancePolicyInput,
} from '@/lib/api/attendance-policies';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';

export function useAttendancePolicies() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.attendance.policies, tenantId],
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
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.attendance.policies, tenantId] });
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
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.attendance.policies, tenantId] });
    },
  });
}

export function useDeleteAttendancePolicy() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: (policyId: string) => deleteAttendancePolicy(policyId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.attendance.policies, tenantId] });
    },
  });
}
