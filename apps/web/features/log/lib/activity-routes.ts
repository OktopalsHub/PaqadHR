import { settingsTabHref } from '@/features/settings/lib/settings-tabs';
import type { TenantActivity } from '@/lib/api/activities';
import { tenantPath } from '@/lib/navigation/tenant-routes';

export function getActivityHref(
  slug: string,
  activity: Pick<TenantActivity, 'resourceType' | 'resourceId' | 'action'>,
): string | null {
  const { resourceType, action } = activity;
  if (!resourceType) return null;

  switch (resourceType) {
    case 'payroll':
      return tenantPath(slug, 'payroll');
    case 'leave':
      return tenantPath(slug, 'leaves');
    case 'settings':
      return tenantPath(slug, 'settings');
    case 'rewards_wallet':
      return settingsTabHref(tenantPath(slug, 'settings'), 'rewards');
    case 'reward':
      return `${tenantPath(slug, 'shoutouts')}?tab=rewards`;
    default:
      if (action.startsWith('settings.')) {
        return tenantPath(slug, 'settings');
      }
      return null;
  }
}

export function formatMetadataChips(metadata: Record<string, unknown> | null): string[] {
  if (!metadata) return [];
  const chips: string[] = [];

  if (typeof metadata.amount === 'number') {
    chips.push(`Amount: ${metadata.amount}`);
  }
  if (typeof metadata.reference === 'string' && metadata.reference) {
    chips.push(`Ref: ${metadata.reference}`);
  }
  if (typeof metadata.pointsCost === 'number') {
    chips.push(`${metadata.pointsCost} pts`);
  }
  if (typeof metadata.rewardName === 'string' && metadata.rewardName) {
    chips.push(metadata.rewardName);
  }
  if (Array.isArray(metadata.changedKeys) && metadata.changedKeys.length > 0) {
    chips.push(metadata.changedKeys.slice(0, 3).join(', '));
  }

  return chips.slice(0, 4);
}
