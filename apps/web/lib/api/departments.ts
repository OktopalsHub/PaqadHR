import { z } from 'zod';
import { apiClient, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';
import { mapApiDepartment } from '@/lib/mappers/department';
import { type Department, departmentSchema } from '@/lib/schemas/department';

type PaginatedDepartments = {
  records: unknown[];
};

export type CreateDepartmentInput = {
  name: string;
  description?: string;
  color?: string;
};

export async function fetchDepartments(): Promise<Department[]> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<PaginatedDepartments>(
    `${tenantPath(tenantId, 'departments')}?limit=100`,
  );

  return z
    .array(departmentSchema)
    .parse((data.records ?? []).map((dept, index) => mapApiDepartment(dept as never, index)));
}

export async function createDepartment(input: CreateDepartmentInput): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, 'departments'), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export type UpdateDepartmentInput = {
  name?: string;
  description?: string;
  color?: string;
};

export async function updateDepartment(
  departmentId: string,
  input: UpdateDepartmentInput,
): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, `departments/${departmentId}`), {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteDepartment(departmentId: string): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, `departments/${departmentId}`), {
    method: 'DELETE',
  });
}
