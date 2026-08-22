'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchEmployeeById, fetchEmployees, updateEmployeeMemberStatus } from '@/lib/api/employees';
import { queryKeys } from '@/lib/query/keys';
import type { Employee } from '@/lib/schemas/employee';
import { useTenant } from '@/providers/tenant-provider';

export function useEmployees<T = Employee[]>(options?: {
  enabled?: boolean;
  select?: (data: Employee[]) => T;
}) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.employees.all, tenantId],
    queryFn: fetchEmployees,
    select: options?.select,
    enabled: (options?.enabled ?? true) && !tenantLoading && Boolean(tenantId),
    staleTime: 60_000,
  });
}

export function useEmployee(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.employees.detail(id ?? ''),
    queryFn: () => fetchEmployeeById(id!),
    enabled: Boolean(id),
  });
}

export function useUpdateEmployeeMemberStatus(memberId: string) {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: (isActive: boolean) => updateEmployeeMemberStatus(memberId, isActive),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.employees.detail(memberId) }),
        queryClient.invalidateQueries({ queryKey: [...queryKeys.employees.all, tenantId] }),
        queryClient.invalidateQueries({
          queryKey: [...queryKeys.employees.detail(memberId), tenantId, 'member'],
        }),
        queryClient.invalidateQueries({
          queryKey: [...queryKeys.employees.all, tenantId, 'directory'],
        }),
      ]);
    },
  });
}
