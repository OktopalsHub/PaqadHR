"use client";

import { useCallback, useMemo } from "react";
import { useTenant } from "@/providers/tenant-provider";
import {
  getNavItems,
  type NavItem,
} from "@/features/navigations/constants/nav-items";
import { tenantPath } from "@/lib/navigation/tenant-routes";

export function useTenantNavItems(): NavItem[] {
  const { tenant } = useTenant();
  return useMemo(
    () => (tenant?.slug ? getNavItems(tenant.slug) : []),
    [tenant?.slug],
  );
}

export function useTenantHref() {
  const { tenant } = useTenant();

  return useCallback(
    (segment?: string) => {
      if (!tenant?.slug) return "#";
      return tenantPath(tenant.slug, segment);
    },
    [tenant?.slug],
  );
}
