import type { TenantActivity } from '../entities/tenant-activity.entity';

export interface TenantActivityListItemDto {
  id: string;
  tenantId: string;
  actorMemberId: string | null;
  actorName: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  description: string;
  status: string;
  severity: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

function formatMemberName(member: TenantActivity['actorMember']): string | null {
  if (!member) return null;
  const preferred = member.preferredName?.trim();
  if (preferred) return preferred;
  const first = member.firstName?.trim() ?? '';
  const last = member.lastName?.trim() ?? '';
  const full = `${first} ${last}`.trim();
  if (full) return full;
  return member.user?.email?.trim() ?? null;
}

export function toTenantActivityListItem(activity: TenantActivity): TenantActivityListItemDto {
  return {
    id: activity.id,
    tenantId: activity.tenantId,
    actorMemberId: activity.actorMemberId,
    actorName: formatMemberName(activity.actorMember),
    action: activity.action,
    resourceType: activity.resourceType,
    resourceId: activity.resourceId,
    description: activity.description,
    status: activity.status,
    severity: activity.severity,
    metadata: activity.metadata,
    createdAt: activity.createdAt,
  };
}
