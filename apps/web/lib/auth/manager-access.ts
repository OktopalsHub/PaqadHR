import type { ApiTenantMember } from '@/lib/mappers/employee';

export function isTenantAdmin(role?: string | null): boolean {
  const normalized = role?.toLowerCase();
  return normalized === 'owner' || normalized === 'admin';
}

export const MANAGE_EMPLOYEE_ORGANIZATION_PERMISSION = 'manage_employee_organization';

export function canManageEmployeeOrganization(
  role?: string | null,
  permissions?: string[] | null,
): boolean {
  return (
    isTenantAdmin(role) || Boolean(permissions?.includes(MANAGE_EMPLOYEE_ORGANIZATION_PERMISSION))
  );
}

export function canManageMember(
  viewerMemberId: string,
  targetMember: Pick<ApiTenantMember, 'id' | 'reportsToId'>,
  viewerRole?: string | null,
): boolean {
  if (isTenantAdmin(viewerRole)) {
    return true;
  }
  if (viewerMemberId === targetMember.id) {
    return true;
  }
  return targetMember.reportsToId === viewerMemberId;
}

export function hasDirectReports(
  viewerMemberId: string,
  members: Pick<ApiTenantMember, 'reportsToId'>[],
): boolean {
  return members.some((member) => member.reportsToId === viewerMemberId);
}

export function canApproveLeaveRequest(
  viewerMemberId: string,
  requesterMemberId: string | undefined,
  members: Pick<ApiTenantMember, 'id' | 'reportsToId'>[],
  viewerRole?: string | null,
): boolean {
  if (!requesterMemberId || requesterMemberId === viewerMemberId) {
    return false;
  }
  if (isTenantAdmin(viewerRole)) {
    return true;
  }
  const requester = members.find((member) => member.id === requesterMemberId);
  return requester?.reportsToId === viewerMemberId;
}

export function canViewTeamPayroll(
  viewerMemberId: string | undefined,
  members: Pick<ApiTenantMember, 'reportsToId'>[],
  viewerRole?: string | null,
): boolean {
  if (isTenantAdmin(viewerRole)) {
    return true;
  }
  return viewerMemberId ? hasDirectReports(viewerMemberId, members) : false;
}
