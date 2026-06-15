import type { Employee } from "@/lib/schemas/employee";

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
  position?: { id: string; title: string };
  department?: { name: string; role?: string };
};

function memberStatus(isActive: boolean): Employee["status"] {
  return isActive ? "Active" : "Inactive";
}

export function mapTenantMemberToEmployee(member: ApiTenantMember): Employee {
  const name =
    [member.firstName, member.lastName].filter(Boolean).join(" ") ||
    member.preferredName ||
    "Unknown";

  return {
    id: member.id,
    name,
    email: member.user.email,
    department: member.department?.name ?? "Unassigned",
    role: member.position?.title ?? "Team Member",
    status: memberStatus(member.isActive),
    joinDate: member.joinDate
      ? new Date(member.joinDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    avatar: member.avatarUrl ?? "",
  };
}

export function mapTenantMembersToEmployees(
  members: ApiTenantMember[],
): Employee[] {
  return members.map(mapTenantMemberToEmployee);
}
