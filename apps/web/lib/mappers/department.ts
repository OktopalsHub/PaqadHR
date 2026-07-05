import { formatDisplayName, formatPersonName } from '@/lib/format-name';
import type { Department, DepartmentMember } from '@/lib/schemas/department';

type ApiDepartmentMember = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  position?: string;
  role?: string;
  isManager?: boolean;
};

type ApiTeamMember = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
  role?: string;
};

type ApiTeam = {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  members: ApiTeamMember[];
};

type ApiDepartment = {
  id: string;
  name: string;
  description?: string;
  color?: string;
  manager?: ApiDepartmentMember;
  members: ApiDepartmentMember[];
  teams?: ApiTeam[];
};

const DEPARTMENT_COLORS = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
];

function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function mapMember(member: ApiDepartmentMember): DepartmentMember {
  const firstName = formatDisplayName(member.firstName, '');
  const lastName = formatDisplayName(member.lastName, '');
  return {
    id: member.id,
    name: formatPersonName(firstName, lastName, member.email),
    email: member.email,
    phone: member.phone,
    role: member.role,
    position: member.position,
    initials: initials(firstName, lastName),
    isManager: member.isManager,
  };
}

function mapTeamMember(member: ApiTeamMember): DepartmentMember {
  const first = formatDisplayName(member.firstName, '');
  const last = formatDisplayName(member.lastName, '');
  const name = formatPersonName(first, last, '') || member.email || 'Member';

  return {
    id: member.id,
    name,
    email: member.email ?? '',
    role: member.role,
    initials: first && last ? initials(first, last) : name.slice(0, 2).toUpperCase(),
  };
}

export function mapApiDepartment(department: ApiDepartment, index: number): Department {
  return {
    id: department.id,
    name: department.name,
    description: department.description ?? undefined,
    color: department.color || DEPARTMENT_COLORS[index % DEPARTMENT_COLORS.length],
    manager: department.manager ? mapMember(department.manager) : undefined,
    members: department.members.map(mapMember),
    teams: department.teams?.map((team) => ({
      id: team.id,
      name: team.name,
      description: team.description ?? undefined,
      memberCount: team.memberCount,
      members: team.members.map(mapTeamMember),
    })),
  };
}
