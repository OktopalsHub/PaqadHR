import { apiClient, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';
import {
  type ApiTenantMember,
  mapTenantMembersToEmployees,
  mapTenantMemberToEmployee,
} from '@/lib/mappers/employee';
import { type Employee, employeeListSchema, employeeSchema } from '@/lib/schemas/employee';

export type UpdateEmployeeInput = {
  firstName?: string;
  lastName?: string;
  preferredName?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  departmentId?: string;
  reportsToId?: string;
};

export type CreateEmployeeInviteInput = {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  departmentId?: string;
  jobTitle?: string;
};

export async function fetchEmployees(): Promise<Employee[]> {
  const tenantId = await resolveTenantId();
  const members = await apiClient<ApiTenantMember[]>(tenantPath(tenantId, 'members'));
  return employeeListSchema.parse(mapTenantMembersToEmployees(members));
}

export async function fetchEmployeeById(id: string): Promise<Employee> {
  const tenantId = await resolveTenantId();
  const member = await apiClient<ApiTenantMember>(tenantPath(tenantId, `members/${id}`));
  return employeeSchema.parse(mapTenantMemberToEmployee(member));
}

export async function fetchTenantMemberById(id: string): Promise<ApiTenantMember> {
  const tenantId = await resolveTenantId();
  return apiClient<ApiTenantMember>(tenantPath(tenantId, `members/${id}`));
}

export async function updateEmployee(id: string, input: UpdateEmployeeInput): Promise<Employee> {
  const tenantId = await resolveTenantId();
  const member = await apiClient<ApiTenantMember>(tenantPath(tenantId, `members/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return employeeSchema.parse(mapTenantMemberToEmployee(member));
}

export async function createEmployeeInvite(input: CreateEmployeeInviteInput): Promise<unknown> {
  const tenantId = await resolveTenantId();
  return apiClient<unknown>(tenantPath(tenantId, 'invites'), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
