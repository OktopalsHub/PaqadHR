import type { ApiEducation } from '@/lib/api/education';
import type { ApiEmergencyContact } from '@/lib/api/emergency-contacts';
import type { ApiTenantMember } from '@/lib/mappers/employee';
import { mapApiEducationRecord, mapApiEmergencyContact } from '@/lib/mappers/employee-records';

export type EmployeeDetailState = ReturnType<typeof createEmployeeDetailState>;

type EmployeeRecordSeed = {
  emergencyContacts?: ApiEmergencyContact[];
  education?: ApiEducation[];
};

export function createEmployeeDetailState(
  member: ApiTenantMember,
  records: EmployeeRecordSeed = {},
) {
  const name =
    [member.firstName, member.lastName].filter(Boolean).join(' ') ||
    member.preferredName ||
    'Unknown';

  const hireDate = member.joinDate ? new Date(member.joinDate).toISOString().slice(0, 10) : '';

  const dateOfBirth = member.dateOfBirth
    ? new Date(member.dateOfBirth).toISOString().slice(0, 10)
    : '';

  return {
    id: member.id,
    firstName: member.firstName,
    lastName: member.lastName,
    name,
    preferredName: member.preferredName ?? '',
    position: member.position?.title ?? 'Team Member',
    department: member.department?.name ?? 'Unassigned',
    email: member.user.email,
    phone: member.phone ?? '',
    dateOfBirth,
    hireDate,
    status: member.isActive ? ('Active' as const) : ('Inactive' as const),
    manager: '',
    profileImage: member.avatarUrl ?? '',
    gender: member.gender ?? '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: '',
    },
    emergencyContacts: (records.emergencyContacts ?? []).map(mapApiEmergencyContact),
    personalInfo: {
      gender: member.gender ?? '',
      maritalStatus: '',
      nationality: '',
      bloodGroup: '',
    },
    employment: {
      employeeId: member.employeeNumber ?? member.id,
      employeeType: '',
      division: '',
      team: '',
      workLocation: '',
      joinDate: hireDate,
      reportingTo: '',
      payGrade: '',
      workSchedule: '',
    },
    compensation: {
      salary: '',
      payFrequency: '',
      bonusPlan: '',
      lastIncrement: {
        date: '',
        percentage: '',
        amount: '',
      },
      benefits: [] as string[],
    },
    documents: [] as {
      id: number;
      name: string;
      type: string;
      dateUploaded: string;
      status: string;
    }[],
    timeOff: {
      availableBalance: {
        vacation: 0,
        sick: 0,
        personal: 0,
      },
      recentRequests: [] as {
        id: number;
        type: string;
        dates: string;
        status: string;
        days: number;
      }[],
    },
    skills: [] as string[],
    education: (records.education ?? []).map(mapApiEducationRecord),
  };
}
