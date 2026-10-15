import { applyDecorators, UseGuards } from '@nestjs/common';
import { RequireFeatures } from 'src/common/decorators/feature-access.decorator';
import { TenantMemberRole } from 'src/common/enums';
import { FeatureAccess } from 'src/common/enums/subscription.enum';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';

const ALL_ROLES = [
  TenantMemberRole.OWNER,
  TenantMemberRole.ADMIN,
  TenantMemberRole.MEMBER,
] as const;
const ADMIN_ROLES = [TenantMemberRole.OWNER, TenantMemberRole.ADMIN] as const;

export function RewardsIntegrationsAllRoles() {
  return applyDecorators(
    RequireFeatures(FeatureAccess.INTEGRATIONS),
    UseGuards(TenantRoleGuard),
    Roles(...ALL_ROLES),
  );
}

export function RewardsIntegrationsAdminRoles() {
  return applyDecorators(
    RequireFeatures(FeatureAccess.INTEGRATIONS),
    UseGuards(TenantRoleGuard),
    Roles(...ADMIN_ROLES),
  );
}

export function RewardsAdminRoles() {
  return applyDecorators(UseGuards(TenantRoleGuard), Roles(...ADMIN_ROLES));
}

export function RewardsAllRoles() {
  return applyDecorators(UseGuards(TenantRoleGuard), Roles(...ALL_ROLES));
}
