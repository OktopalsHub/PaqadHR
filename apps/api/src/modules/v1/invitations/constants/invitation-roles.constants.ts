import { TenantMemberRole } from '../../../../common/enums/tenant-member.enum';

export const INVITABLE_ROLES = [TenantMemberRole.MEMBER, TenantMemberRole.ADMIN] as const;
