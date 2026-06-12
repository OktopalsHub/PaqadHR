import { apiClient, tenantPath } from "@/lib/api/client";
import { resolveTenantId } from "@/lib/api/tenants";
import { mapApiDepartment } from "@/lib/mappers/department";
import { departmentSchema, type Department } from "@/lib/schemas/department";
import { z } from "zod";

type PaginatedDepartments = {
  records: unknown[];
};

export async function fetchDepartments(): Promise<Department[]> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<PaginatedDepartments>(
    `${tenantPath(tenantId, "departments")}?limit=100`,
  );

  return z
    .array(departmentSchema)
    .parse(
      (data.records ?? []).map((dept, index) =>
        mapApiDepartment(dept as never, index),
      ),
    );
}
