'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import { getNavItems, type NavItem } from '@/features/navigations/constants/nav-items';
import { isTenantAdmin } from '@/lib/auth/manager-access';
import { getTenantSlugFromPath, tenantPath } from '@/lib/navigation/tenant-routes';
import { useTenant } from '@/providers/tenant-provider';

export const ADMIN_ONLY_SEGMENTS: ReadonlySet<string> = new Set([
  'payroll',
  'recruitment',
  'analytics',
  'logs',
]);

/** Admin-only pages stay hidden until the role is known to be owner or admin. */
export function filterNavItemsByRole(items: NavItem[], role?: string | null): NavItem[] {
  if (isTenantAdmin(role)) return items;
  return items.filter((item) => !item.segment || !ADMIN_ONLY_SEGMENTS.has(item.segment));
}

export function useTenantNavItems(): NavItem[] {
  const { tenant } = useTenant();
  const pathname = usePathname();

  return useMemo(() => {
    const slug = tenant?.slug ?? getTenantSlugFromPath(pathname);
    if (!slug) return [];

    const items = getNavItems(slug).filter((item) => item.segment !== 'settings');
    return filterNavItemsByRole(items, tenant?.member?.role);
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
