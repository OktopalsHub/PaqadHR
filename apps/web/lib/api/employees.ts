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
  firstName?: string;
  lastName?: string;
  preferredName?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  departmentId?: string;
  reportsToId?: string;
  avatarKey?: string;
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

export async function createEmployeeInvite(
  input: CreateEmployeeInviteInput,
): Promise<CreateEmployeeInviteResponse> {
  const tenantId = await resolveTenantId();
  return apiClient<CreateEmployeeInviteResponse>(tenantPath(tenantId, 'invites'), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
