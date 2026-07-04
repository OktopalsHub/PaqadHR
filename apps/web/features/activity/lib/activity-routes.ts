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
