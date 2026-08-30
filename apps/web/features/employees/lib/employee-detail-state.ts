import type { ApiAddress } from '@/lib/api/address';
import type { ApiEducation } from '@/lib/api/education';
import type { ApiEmergencyContact } from '@/lib/api/emergency-contacts';
import { normalizeGender } from '@/lib/constants/gender';
import type { ApiTenantMember } from '@/lib/mappers/employee';
import { mapApiEducationRecord, mapApiEmergencyContact } from '@/lib/mappers/employee-records';

export function memberFullName(employee: {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  preferredName?: string;
  name?: string;
}) {
  const full = [employee.firstName, employee.middleName, employee.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (full) return full;
  if (employee.preferredName?.trim()) return employee.preferredName.trim();
  if (employee.name?.trim()) return employee.name.trim();
  return 'Employee';
}

export function employeeDisplayName(employee: {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  preferredName?: string;
  name?: string;
}) {
  return memberFullName(employee);
}

export type EmployeeDetailState = ReturnType<typeof createEmployeeDetailState>;

type EmployeeRecordSeed = {
  emergencyContacts?: ApiEmergencyContact[];
  education?: ApiEducation[];
  address?: ApiAddress | null;
};

export function createEmployeeDetailState(
  member: ApiTenantMember,
  records: EmployeeRecordSeed = {},
  options?: { managerName?: string },
) {
  const name = memberFullName(member) || 'Unknown';

  const hireDate = member.joinDate ? new Date(member.joinDate).toISOString().slice(0, 10) : '';

  const dateOfBirth = member.dateOfBirth
    ? new Date(member.dateOfBirth).toISOString().slice(0, 10)
    : '';

  const addressRecord = records.address;

  const gender = normalizeGender(member.gender);

  return {
    id: member.id,
    firstName: member.firstName,
    middleName: member.middleName ?? '',
    lastName: member.lastName,
    name,
    preferredName: member.preferredName ?? '',
    workspaceRole: member.role,
    permissions: member.permissions ?? [],
    position: member.position?.title ?? '',
    department: member.department?.name ?? '',
    departmentId: member.department?.id ?? '',
    reportsToId: member.reportsToId ?? '',
    email: member.user.email,
    phone: member.phone ?? '',
    dateOfBirth,
    identityBvn: '',
    identityNin: '',
    hasIdentityBvn: member.hasIdentityBvn ?? false,
    hasIdentityNin: member.hasIdentityNin ?? false,
    hireDate,
    status: member.isActive ? ('Active' as const) : ('Inactive' as const),
    manager: options?.managerName ?? '',
    profileImage: member.avatarUrl ?? '',
    gender,
    addressId: addressRecord?.id ?? '',
    address: {
      street: addressRecord?.street ?? '',
      city: addressRecord?.city ?? '',
      state: addressRecord?.state ?? '',
      zipCode: addressRecord?.postalCode ?? '',
      country: addressRecord?.country ?? '',
    },
    emergencyContacts: (records.emergencyContacts ?? []).map(mapApiEmergencyContact),
    personalInfo: {
      gender,
    },
    employment: {
      employeeId: member.employeeNumber ?? '',
      joinDate: hireDate,
    },
    education: (records.education ?? []).map(mapApiEducationRecord),
  };
}
