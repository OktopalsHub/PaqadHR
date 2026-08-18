'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { CreateTenantInput, UpdateTenantInput } from '@/lib/api/tenants';
import {
  createTenant,
  fetchUserTenants,
  invalidateTenantCache,
  updateTenant,
} from '@/lib/api/tenants';
import { cacheKeys, getCached, setCached } from '@/lib/cache';
import { queryKeys } from '@/lib/query/keys';
import type { Tenant } from '@/lib/schemas/tenant';
import { readTenantId } from '@/lib/session';

export function useUserTenants(options?: { enabled?: boolean }) {
  // Try to get cached tenants for instant render
  const cachedTenants = useMemo(() => {
    return getCached<Tenant[]>(cacheKeys.tenants.all);
  }, []);

  return useQuery({
    queryKey: queryKeys.tenants.all,
    queryFn: async () => {
      const tenants = await fetchUserTenants();
      // Cache tenants for instant subsequent loads
      if (tenants.length > 0) {
        setCached(cacheKeys.tenants.all, tenants, { ttl: 5 * 60 * 1000 }); // 5 minutes
      }
      return tenants;
    },
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false,
    // Use cached data as initial data for instant render
    initialData: cachedTenants ?? undefined,
  });
}

export function useCreateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTenantInput) => createTenant(input),
    onSuccess: () => {
      invalidateTenantCache();
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
      invalidateTenantCache();
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
