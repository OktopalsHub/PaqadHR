'use client';

import { useCallback, useMemo } from 'react';
import { getNavItems, type NavItem } from '@/features/navigations/constants/nav-items';
import { isTenantAdmin } from '@/lib/auth/manager-access';
import { tenantPath } from '@/lib/navigation/tenant-routes';
import { useTenant } from '@/providers/tenant-provider';

export function useTenantNavItems(): NavItem[] {
  const { tenant } = useTenant();
  return useMemo(() => {
    if (!tenant?.slug) return [];

    const items = getNavItems(tenant.slug).filter((item) => item.segment !== 'settings');
    if (!isTenantAdmin(tenant.member?.role)) {
      return items.filter((item) => item.segment !== 'activity');
    }

    return items;
  }, [tenant?.slug, tenant?.member?.role]);
}

export function useTenantHref() {
  const { tenant } = useTenant();

  return useCallback(
    (segment?: string) => {
      if (!tenant?.slug) return '#';
      return tenantPath(tenant.slug, segment);
    },
    [tenant?.slug],
  );
}
