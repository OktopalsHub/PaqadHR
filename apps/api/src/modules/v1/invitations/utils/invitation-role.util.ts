import { TenantMemberRole } from '../../../../common/enums/tenant-member.enum';

export const INVITABLE_ROLES = [TenantMemberRole.MEMBER, TenantMemberRole.ADMIN] as const;

export function resolveInvitedMemberRole(role: string): TenantMemberRole {
  return (INVITABLE_ROLES as readonly string[]).includes(role)
    ? (role as TenantMemberRole)
    : TenantMemberRole.MEMBER;
}
