import { formatDisplayName, formatPersonName } from '@/lib/format-name';
import type { Employee } from '@/lib/schemas/employee';

export type ApiTenantMember = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  employeeNumber?: string;
  role: string;
  isActive: boolean;
  joinDate?: string;
  avatarUrl?: string;
  reportsToId?: string;
  user: { email: string };
  position?: { id: string; title: string; color?: string };
  department?: { name: string; role?: string; color?: string };
};

export function formatApiTenantMember(member: ApiTenantMember): ApiTenantMember {
  return {
    ...member,
    firstName: formatDisplayName(member.firstName, member.firstName),
    lastName: formatDisplayName(member.lastName, member.lastName),
    preferredName: member.preferredName
      ? formatDisplayName(member.preferredName)
      : member.preferredName,
  };
}

function memberStatus(isActive: boolean): Employee['status'] {
  return isActive ? 'Active' : 'Inactive';
}

export function mapTenantMemberToEmployee(member: ApiTenantMember): Employee {
  const name =
    formatPersonName(member.firstName, member.lastName, '') ||
    formatDisplayName(member.preferredName, 'Unknown');

  return {
    id: member.id,
    name,
    email: member.user.email,
    department: member.department?.name ?? '',
    role: member.position?.title ?? '',
    status: memberStatus(member.isActive),
    joinDate: member.joinDate ? new Date(member.joinDate).toISOString().slice(0, 10) : '',
    avatar: member.avatarUrl ?? '',
    reportsToId: member.reportsToId ?? undefined,
    employeeNumber: member.employeeNumber,
    departmentColor: member.department?.color,
    positionColor: member.position?.color,
  };
}

export function mapTenantMembersToEmployees(members: ApiTenantMember[]): Employee[] {
  return members.map(mapTenantMemberToEmployee);
}
