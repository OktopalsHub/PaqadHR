import { ForbiddenException } from '@nestjs/common';
import { TenantMemberRole } from 'src/common/enums';

export const PRIVILEGED_ROLES: string[] = [TenantMemberRole.ADMIN, TenantMemberRole.OWNER];

export const assertRoleChangeAllowed = (
  actorRole: string,
  currentRole: string,
  nextRole: string,
): void => {
  if (actorRole === TenantMemberRole.OWNER) {
    return;
  }
  if (actorRole !== TenantMemberRole.ADMIN) {
    throw new ForbiddenException('Only an owner or admin can change roles');
  }
  if (PRIVILEGED_ROLES.includes(currentRole)) {
    throw new ForbiddenException('Only an owner can change an admin or owner');
  }
  if (PRIVILEGED_ROLES.includes(nextRole)) {
    throw new ForbiddenException('Only an owner can grant the admin or owner role');
  }
};
