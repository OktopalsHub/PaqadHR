'use client';

import { useRouter } from 'next/navigation';
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
import { tenantRoot } from '@/lib/navigation/tenant-routes';
import type { Tenant } from '@/lib/schemas/tenant';
import { persistTenantId, persistTenantSlug, readTenantId } from '@/lib/session';
import { useAuth } from '@/providers/auth-provider';

interface TenantContextValue {
  tenants: Tenant[];
  tenant: Tenant | null;
  tenantId: string | null;
  setTenantId: (tenantId: string) => void;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { data: tenants = [], isLoading } = useUserTenants({
    enabled: isAuthenticated,
  });
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
      isLoading: isAuthenticated ? isLoading : false,
    }),
    [tenants, tenant, setTenantId, isLoading, isAuthenticated],
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
