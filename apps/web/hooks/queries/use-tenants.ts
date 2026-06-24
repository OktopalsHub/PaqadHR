'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createTenant, fetchUserTenants, updateTenant } from '@/lib/api/tenants';
import { queryKeys } from '@/lib/query/keys';
import { readTenantId } from '@/lib/session';
import type { CreateTenantInput, UpdateTenantInput } from '@/lib/api/tenants';

export function useUserTenants(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.tenants.all,
    queryFn: fetchUserTenants,
    enabled: options?.enabled ?? true,
    refetchOnMount: 'always',
  });
}

export function useCreateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTenantInput) => createTenant(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all });
    },
  });
}

export function useUpdateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tenantId, input }: { tenantId: string; input: UpdateTenantInput }) =>
      updateTenant(tenantId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all });
    },
  });
}

export function useCurrentTenantId() {
  const { data: tenants = [], isLoading } = useUserTenants();
  const stored = typeof window !== 'undefined' ? readTenantId() : null;
  const tenant =
    tenants.find((item) => item.id === stored) ??
    tenants.find((item) => item.isActive) ??
    tenants[0];

  return { tenantId: tenant?.id ?? null, tenant, isLoading };
}
