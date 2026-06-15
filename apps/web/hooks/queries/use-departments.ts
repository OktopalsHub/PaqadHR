'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type CreateDepartmentInput,
  createDepartment,
  fetchDepartments,
} from '@/lib/api/departments';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';

export function useDepartments() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.departments.all, tenantId],
    queryFn: fetchDepartments,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateDepartmentInput) => createDepartment(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.departments.all,
      });
    },
  });
}
