import { apiClient, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';
import {
  type ApiTenantMember,
  formatApiTenantMember,
  mapTenantMembersToEmployees,
  mapTenantMemberToEmployee,
} from '@/lib/mappers/employee';
import { type Employee, employeeListSchema, employeeSchema } from '@/lib/schemas/employee';

export type UpdateEmployeeInput = {
  role?: string;
  permissions?: string[];
  departmentId?: string | null;
  reportsToId?: string | null;
};

export type CreateEmployeeInviteInput = {
  email: string;
  role: string;
  departmentId?: string;
  positionId?: string;
};

export type CreateEmployeeInviteResponse = {
  id: string;
  email: string;
  emailSent?: boolean;
  emailError?: string;
};

export async function fetchTenantMembers(): Promise<ApiTenantMember[]> {
  const tenantId = await resolveTenantId();
  const members = await apiClient<ApiTenantMember[]>(tenantPath(tenantId, 'members'));
  return Array.isArray(members) ? members.map(formatApiTenantMember) : [];
}

export async function fetchEmployees(): Promise<Employee[]> {
  const members = await fetchTenantMembers();
  return employeeListSchema.parse(mapTenantMembersToEmployees(members));
}

export async function fetchEmployeeById(id: string): Promise<Employee> {
  const tenantId = await resolveTenantId();
  const member = await apiClient<ApiTenantMember>(tenantPath(tenantId, `members/${id}`));
  return employeeSchema.parse(mapTenantMemberToEmployee(formatApiTenantMember(member)));
}

export async function fetchTenantMemberById(id: string): Promise<ApiTenantMember> {
  const tenantId = await resolveTenantId();
  const member = await apiClient<ApiTenantMember>(tenantPath(tenantId, `members/${id}`));
  return formatApiTenantMember(member);
}

export async function updateEmployee(id: string, input: UpdateEmployeeInput): Promise<Employee> {
  const tenantId = await resolveTenantId();
  const member = await apiClient<ApiTenantMember>(tenantPath(tenantId, `members/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return employeeSchema.parse(mapTenantMemberToEmployee(formatApiTenantMember(member)));
}

export async function updateEmployeeMemberStatus(id: string, isActive: boolean): Promise<Employee> {
  const tenantId = await resolveTenantId();
  const member = await apiClient<ApiTenantMember>(tenantPath(tenantId, `members/${id}/status`), {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
  return employeeSchema.parse(mapTenantMemberToEmployee(formatApiTenantMember(member)));
}

export async function createEmployeeInvite(
  input: CreateEmployeeInviteInput,
): Promise<CreateEmployeeInviteResponse> {
  const tenantId = await resolveTenantId();
  return apiClient<CreateEmployeeInviteResponse>(tenantPath(tenantId, 'invites'), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
