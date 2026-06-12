"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchDepartments } from "@/lib/api/departments";
import { queryKeys } from "@/lib/query/keys";
import { useTenant } from "@/providers/tenant-provider";

export function useDepartments() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.departments.all, tenantId],
    queryFn: fetchDepartments,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}
