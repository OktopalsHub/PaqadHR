"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchUserTenants } from "@/lib/api/tenants";
import { queryKeys } from "@/lib/query/keys";
import { readTenantId } from "@/lib/session";

export function useUserTenants(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.tenants.all,
    queryFn: fetchUserTenants,
    enabled: options?.enabled ?? true,
  });
}

export function useCurrentTenantId() {
  const { data: tenants = [], isLoading } = useUserTenants();
  const stored = typeof window !== "undefined" ? readTenantId() : null;
  const tenant =
    tenants.find((item) => item.id === stored) ??
    tenants.find((item) => item.isActive) ??
    tenants[0];

  return { tenantId: tenant?.id ?? null, tenant, isLoading };
}
