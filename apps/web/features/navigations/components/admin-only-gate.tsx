'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingBlock } from '@/components/loading-block';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import { isTenantAdmin } from '@/lib/auth/manager-access';
import { useTenant } from '@/providers/tenant-provider';

/** Redirects non-admins to the workspace dashboard. */
export function AdminOnlyGate({ children }: { children: React.ReactNode }) {
  const { tenant, isLoading } = useTenant();
  const router = useRouter();
  const tenantHref = useTenantHref();
  const isAdmin = isTenantAdmin(tenant?.member?.role);

  useEffect(() => {
    if (!isLoading && tenant && !isAdmin) {
      router.replace(tenantHref());
    }
  }, [isAdmin, isLoading, router, tenant, tenantHref]);

  if (isLoading || !tenant) {
    return <LoadingBlock />;
  }

  if (!isAdmin) {
    return <LoadingBlock />;
  }

  return <>{children}</>;
}
