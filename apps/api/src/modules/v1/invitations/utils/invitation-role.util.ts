import { TenantMemberRole } from '../../../../common/enums/tenant-member.enum';
import { INVITABLE_ROLES } from '../constants/invitation-roles.constants';

export function resolveInvitedMemberRole(role: string): TenantMemberRole {
  return (INVITABLE_ROLES as readonly string[]).includes(role)
    ? (role as TenantMemberRole)
    : TenantMemberRole.MEMBER;
}
