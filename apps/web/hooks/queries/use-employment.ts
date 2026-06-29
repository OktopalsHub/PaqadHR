'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addCompensation,
  type CreateCompensationInput,
  type CreateEmploymentInput,
  createEmployment,
  fetchEmployments,
  type UpdateEmploymentInput,
  updateEmployment,
} from '@/lib/api/employment';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';

export function useEmployments(memberId?: string, enabled = true) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.employees.detail(memberId ?? ''), tenantId, 'employments'],
    queryFn: () => fetchEmployments(memberId!),
    enabled: enabled && !tenantLoading && Boolean(tenantId && memberId),
  });
}

export function useAddCompensation(memberId: string) {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: (input: CreateCompensationInput) => addCompensation(memberId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.employees.detail(memberId), tenantId, 'employments'],
      });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.employees.detail(memberId), tenantId, 'member'],
      });
    },
  });
}

export function useCreateEmployment(memberId: string) {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: (input: CreateEmploymentInput) => createEmployment(memberId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.employees.detail(memberId), tenantId, 'employments'],
      });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.employees.detail(memberId), tenantId, 'member'],
      });
    },
  });
}

export function useUpdateEmployment(memberId: string) {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: ({ employmentId, input }: { employmentId: string; input: UpdateEmploymentInput }) =>
      updateEmployment(employmentId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.employees.detail(memberId), tenantId, 'employments'],
      });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.employees.detail(memberId), tenantId, 'member'],
      });
    },
  });
}
