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
  isSubdomainTenantsEnabled,
  tenantOrigin,
  tenantRoot,
} from '@/lib/navigation/tenant-routes';
import type { Tenant } from '@/lib/schemas/tenant';
import { persistTenantId, persistTenantSlug, readTenantId } from '@/lib/session';
import { useAuth } from '@/providers/auth-provider';

interface TenantContextValue {
  tenants: Tenant[];
  tenant: Tenant | null;
  tenantId: string | null;
  setTenantId: (tenantId: string) => void;
  isLoading: boolean;
  hasResolvedTenants: boolean;
  isError: boolean;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const tenantsQuery = useUserTenants({ enabled: isAuthenticated });
  const tenants = tenantsQuery.data ?? [];
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

  const isLoading = authLoading || (isAuthenticated && tenantsQuery.isPending);
  const hasResolvedTenants = !isAuthenticated || tenantsQuery.isFetched;
  const isError = isAuthenticated && tenantsQuery.isError;

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
    }
  }, [tenants, pathname, selectedId]);

  useEffect(() => {
    if (!tenant) return;
    persistTenantId(tenant.id);
    if (tenant.slug) persistTenantSlug(tenant.slug);
  }, [tenant]);

  const setTenantId = useCallback(
    (tenantId: string) => {
      const next = tenants.find((item) => item.id === tenantId);
      persistTenantId(tenantId);
      setSelectedId(tenantId);
      if (next?.slug) {
        persistTenantSlug(next.slug);
        if (isSubdomainTenantsEnabled()) {
          window.location.assign(tenantOrigin(next.slug));
          return;
        }
        router.push(tenantRoot(next.slug));
      }
    },
    [tenants, router],
  );

  const value = useMemo<TenantContextValue>(
    () => ({
      tenants,
      tenant,
      tenantId: tenant?.id ?? null,
      setTenantId,
      isLoading,
      hasResolvedTenants,
      isError,
    }),
    [tenants, tenant, setTenantId, isLoading, hasResolvedTenants, isError],
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
