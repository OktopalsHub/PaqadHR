'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type CreateDepartmentInput,
  createDepartment,
  deleteDepartment,
  fetchDepartments,
  type UpdateDepartmentInput,
  updateDepartment,
} from '@/lib/api/departments';
import { queryKeys } from '@/lib/query/keys';
import type { Department } from '@/lib/schemas/department';
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
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: (input: CreateDepartmentInput) => createDepartment(input),
    onSuccess: async (created, input) => {
      const key = [...queryKeys.departments.all, tenantId] as const;
      queryClient.setQueryData<Department[]>(key, (current) => {
        const list = current ?? [];
        if (list.some((dept) => dept.id === created.id)) return list;
        return [
          ...list,
          {
            id: created.id,
            name: input.name,
            description: input.description,
            color: input.color ?? '#3b82f6',
            members: [],
          },
        ];
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.departments.all });
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateDepartmentInput }) =>
      updateDepartment(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.departments.all });
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteDepartment(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.departments.all });
    },
  });
}
