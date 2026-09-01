'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useUserTenants } from '@/hooks/queries/use-tenants';
import {
  getTenantSlugFromHost,
  getTenantSlugFromPath,
  goToTenantPath,
  isOnTenantSubdomain,
  isSubdomainTenantsEnabled,
  tenantOrigin,
} from '@/lib/navigation/tenant-routes';
import type { Tenant } from '@/lib/schemas/tenant';
import { persistTenantId, persistTenantSlug, readTenantId } from '@/lib/session';
import { useAuth } from '@/providers/auth-provider';

interface TenantContextValue {
  tenants: Tenant[];
  tenant: Tenant | null;
  tenantId: string | null;
  selectTenantId: (tenantId: string) => void;
  setTenantId: (tenantId: string) => void;
  isLoading: boolean;
  hasResolvedTenants: boolean;
  isError: boolean;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    workspaces,
    isAuthenticated,
    isLoading: authLoading,
    hasResolvedSession,
  } = useAuth();

  const tenantsQuery = useUserTenants({
    enabled: false,
    initialWorkspaces: hasResolvedSession ? workspaces : undefined,
  });
  const tenants = hasResolvedSession ? workspaces : (tenantsQuery.data ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    typeof window !== 'undefined' ? readTenantId() : null,
  );

  const tenant = useMemo(() => {
    if (!tenants.length) return null;
    return (
      tenants.find((item) => item.id === selectedId) ??
      tenants.find((item) => item.isActive) ??
      tenants[0]
    );
  }, [tenants, selectedId]);

  const isLoading = authLoading || (isAuthenticated && !hasResolvedSession);
  const hasResolvedTenants = !isAuthenticated || hasResolvedSession;
  const isError = false;

  useEffect(() => {
    if (!tenants.length) return;
    const slugFromHost =
      typeof window !== 'undefined' ? getTenantSlugFromHost(window.location.host) : null;
    const slugFromPath = getTenantSlugFromPath(pathname);
    const slug = slugFromHost ?? slugFromPath;
    if (!slug) return;
    const match = tenants.find((item) => item.slug === slug);
    if (match && match.id !== selectedId) {
      setSelectedId(match.id);
      persistTenantId(match.id);
      if (match.slug) persistTenantSlug(match.slug);
    }
  }, [tenants, pathname, selectedId]);

  useEffect(() => {
    if (!tenant) return;
    persistTenantId(tenant.id);
    if (tenant.slug) persistTenantSlug(tenant.slug);
  }, [tenant]);

  const selectTenantId = useCallback(
    (tenantId: string) => {
      const next = tenants.find((item) => item.id === tenantId);
      persistTenantId(tenantId);
      setSelectedId(tenantId);
      if (next?.slug) persistTenantSlug(next.slug);
    },
    [tenants],
  );

  const setTenantId = useCallback(
    (tenantId: string) => {
      const next = tenants.find((item) => item.id === tenantId);
      selectTenantId(tenantId);
      if (!next?.slug) return;

      const onSubdomain = isOnTenantSubdomain();
      const hostSlug =
        typeof window !== 'undefined' ? getTenantSlugFromHost(window.location.host) : null;
      if (onSubdomain && hostSlug === next.slug) return;

      if (isSubdomainTenantsEnabled()) {
        window.location.assign(tenantOrigin(next.slug));
        return;
      }
      goToTenantPath(next.slug, router.push);
    },
    [tenants, router, selectTenantId],
  );

  const value = useMemo<TenantContextValue>(
    () => ({
      tenants,
      tenant,
      tenantId: tenant?.id ?? null,
      selectTenantId,
      setTenantId,
      isLoading,
      hasResolvedTenants,
      isError,
    }),
    [tenants, tenant, selectTenantId, setTenantId, isLoading, hasResolvedTenants, isError],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
