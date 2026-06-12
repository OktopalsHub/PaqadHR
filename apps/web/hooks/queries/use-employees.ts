"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchEmployeeById, fetchEmployees } from "@/lib/api/employees";
import { queryKeys } from "@/lib/query/keys";
import { useTenant } from "@/providers/tenant-provider";

export function useEmployees() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.employees.all, tenantId],
    queryFn: fetchEmployees,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useEmployee(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.employees.detail(id ?? ""),
    queryFn: () => fetchEmployeeById(id!),
    enabled: Boolean(id),
  });
}
