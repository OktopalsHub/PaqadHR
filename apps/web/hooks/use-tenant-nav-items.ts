'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { getNavItems, type NavItem } from '@/features/navigations/constants/nav-items';
import { isTenantAdmin } from '@/lib/auth/manager-access';
import { getTenantSlugFromPath, tenantPath } from '@/lib/navigation/tenant-routes';
import { useTenant } from '@/providers/tenant-provider';

export function useTenantNavItems(): NavItem[] {
  const { tenant } = useTenant();
  const pathname = usePathname();

  return useMemo(() => {
    const slug = tenant?.slug ?? getTenantSlugFromPath(pathname);
    if (!slug) return [];

    const items = getNavItems(slug).filter((item) => item.segment !== 'settings');
    // The URL supplies the current workspace while its membership record loads.
    // Role-based filtering is applied as soon as the server-provided role arrives.
    if (!tenant?.member?.role) return items;

    if (isTenantAdmin(tenant.member?.role)) {
      return items;
    }

    const memberHidden = new Set(['payroll', 'recruitment', 'analytics', 'activity']);
    return items.filter((item) => !item.segment || !memberHidden.has(item.segment));
  }, [pathname, tenant?.slug, tenant?.member?.role]);
}

export function useTenantHref() {
  const { tenant } = useTenant();
  const pathname = usePathname();

  return useCallback(
    (segment?: string) => {
      const slug = tenant?.slug ?? getTenantSlugFromPath(pathname);
      if (!slug) return '#';
      return tenantPath(slug, segment);
    },
    [pathname, tenant?.slug],
  );
}
