import type { FileUrlService } from 'src/common/services/file-url.service';
import { formatMemberDisplayName } from 'src/common/utils/member-display.util';
import type { TenantActivity } from '../entities/tenant-activity.entity';

export interface TenantActivityListItemDto {
  id: string;
  tenantId: string;
  actorMemberId: string | null;
  actorName: string | null;
  actorAvatarUrl: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  description: string;
  status: string;
  severity: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

const TENANT_HIDDEN_METADATA_KEYS = ['provider', 'paymentProvider'] as const;

function sanitizeTenantActivityMetadata(
  metadata: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!metadata) return null;
  const sanitized = { ...metadata };
  for (const key of TENANT_HIDDEN_METADATA_KEYS) {
    delete sanitized[key];
  }
  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

function formatActorAvatarUrl(
  activity: TenantActivity,
  fileUrlService?: FileUrlService,
): string | null {
  const avatarKey = activity.actorMember?.avatarKey?.trim();
  if (!avatarKey || !fileUrlService) return null;
  return fileUrlService.getMemberAvatarUrl(activity.tenantId, avatarKey);
}

export function toTenantActivityListItem(
  activity: TenantActivity,
  fileUrlService?: FileUrlService,
): TenantActivityListItemDto {
  return {
    id: activity.id,
    tenantId: activity.tenantId,
    actorMemberId: activity.actorMemberId,
    actorName: formatMemberDisplayName(activity.actorMember),
    actorAvatarUrl: formatActorAvatarUrl(activity, fileUrlService),
    action: activity.action,
    resourceType: activity.resourceType,
    resourceId: activity.resourceId,
    description: activity.description,
    status: activity.status,
    severity: activity.severity,
    metadata: sanitizeTenantActivityMetadata(activity.metadata),
    createdAt: activity.createdAt,
  };
}
