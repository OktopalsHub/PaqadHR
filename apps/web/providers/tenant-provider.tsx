"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/providers/auth-provider";
import { useUserTenants } from "@/hooks/queries/use-tenants";
import { persistTenantId, readTenantId } from "@/lib/session";
import type { Tenant } from "@/lib/schemas/tenant";

interface TenantContextValue {
  tenants: Tenant[];
  tenant: Tenant | null;
  tenantId: string | null;
  setTenantId: (tenantId: string) => void;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { data: tenants = [], isLoading } = useUserTenants({
    enabled: isAuthenticated,
  });
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    typeof window !== "undefined" ? readTenantId() : null,
  );

  const tenant = useMemo(() => {
    if (!tenants.length) return null;
    return (
      tenants.find((item) => item.id === selectedId) ??
      tenants.find((item) => item.isActive) ??
      tenants[0]
    );
  }, [tenants, selectedId]);

  const setTenantId = useCallback((tenantId: string) => {
    persistTenantId(tenantId);
    setSelectedId(tenantId);
  }, []);

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

  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}
