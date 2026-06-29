import type { ApiAddress } from '@/lib/api/address';
import type { ApiEducation } from '@/lib/api/education';
import type { ApiEmergencyContact } from '@/lib/api/emergency-contacts';
import { normalizeGender } from '@/lib/constants/gender';
import type { ApiTenantMember } from '@/lib/mappers/employee';
import { mapApiEducationRecord, mapApiEmergencyContact } from '@/lib/mappers/employee-records';

export function employeeDisplayName(employee: {
  firstName?: string;
  lastName?: string;
  preferredName?: string;
  name?: string;
}) {
  const full = [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (employee.preferredName?.trim()) return employee.preferredName.trim();
  if (employee.name?.trim()) return employee.name.trim();
  return 'Employee';
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
  const name =
    [member.firstName, member.lastName].filter(Boolean).join(' ') ||
    member.preferredName ||
    'Unknown';

  const hireDate = member.joinDate ? new Date(member.joinDate).toISOString().slice(0, 10) : '';

  const dateOfBirth = member.dateOfBirth
    ? new Date(member.dateOfBirth).toISOString().slice(0, 10)
    : '';

  const addressRecord = records.address;

  const gender = normalizeGender(member.gender);

  return {
    id: member.id,
    firstName: member.firstName,
    lastName: member.lastName,
    name,
    preferredName: member.preferredName ?? '',
    position: member.position?.title ?? '',
    department: member.department?.name ?? '',
    email: member.user.email,
    phone: member.phone ?? '',
    dateOfBirth,
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
