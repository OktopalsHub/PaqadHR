'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LoadingSpinner } from '@/components/loading-block';
import { PageLoadingSkeleton } from '@/components/page-loading-skeleton';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import { isTenantAdmin } from '@/lib/auth/manager-access';
import { useTenant } from '@/providers/tenant-provider';

// Kept for the lifetime of the browser session so client-side page changes do
// not replay the SSR hydration placeholder after the first protected route.
let hasClientHydrated = false;

/** Redirects non-admins to the workspace dashboard. */
export function AdminOnlyGate({ children }: { children: React.ReactNode }) {
  const { tenant, isLoading } = useTenant();
  const router = useRouter();
  const tenantHref = useTenantHref();
  const [hasHydrated, setHasHydrated] = useState(() => hasClientHydrated);
  const isAdmin = isTenantAdmin(tenant?.member?.role);

  useEffect(() => {
    hasClientHydrated = true;
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (!isLoading && tenant && !isAdmin) {
      router.replace(tenantHref());
    }
  }, [isAdmin, isLoading, router, tenant, tenantHref]);

  if (!hasHydrated || isLoading) {
    // Use deterministic, page-local markup until the client has restored the
    // workspace role. This preserves the application shell without allowing
    // server and client to render different protected content during hydration.
    return <PageLoadingSkeleton />;
  }

  if (!tenant) {
    return <LoadingSpinner />;
  }

  if (!isAdmin) {
    return <LoadingSpinner />;
  }

  return <>{children}</>;
}
