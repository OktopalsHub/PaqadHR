'use client';

import { useParams, usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingBlock } from '@/components/loading-block';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/hooks/use-auth';
import {
  captureAuthReturnTo,
  goToAuthDestination,
  resolveAuthDestination,
} from '@/lib/navigation/resolve-auth-destination';
import { isSubdomainTenantsEnabled, tenantRoot, tenantUrl } from '@/lib/navigation/tenant-routes';
import { useTenant } from '@/providers/tenant-provider';

export function TenantSlugGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = params.tenantSlug;
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { tenant, tenants, isLoading: tenantLoading, hasResolvedTenants, isError } = useTenant();

  const isLoading = authLoading || (isAuthenticated && tenantLoading);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      const destination = resolveAuthDestination({
        isAuthenticated: false,
        tenants: [],
        redirect: captureAuthReturnTo(pathname),
      });
      goToAuthDestination(destination, router.replace);
      return;
    }

    if (tenantLoading || !hasResolvedTenants || isError) return;

    const destination = resolveAuthDestination({ isAuthenticated: true, tenants });
    if (destination.type === 'onboarding') {
      goToAuthDestination(destination, router.replace);
      return;
    }

    const slugTenant = tenants.find((item) => item.slug === tenantSlug);
    if (!slugTenant) {
      if (tenant) {
        if (isSubdomainTenantsEnabled()) {
          window.location.assign(tenantUrl(tenant.slug, pathname));
          return;
        }
        const suffix = pathname.replace(`/${tenantSlug}`, '') || '';
        router.replace(`${tenantRoot(tenant.slug)}${suffix}`);
      }
      return;
    }
  }, [
    authLoading,
    isAuthenticated,
    tenantLoading,
    hasResolvedTenants,
    isError,
    tenant,
    tenantSlug,
    tenants,
    pathname,
    router,
  ]);

  if (isLoading || !hasResolvedTenants) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <LoadingBlock />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <LoadingBlock />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle>Unable to load workspace</AlertTitle>
          <AlertDescription>Refresh the page or try signing in again.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const slugTenant = tenants.find((item) => item.slug === tenantSlug);
  if (tenants.length === 0 || !slugTenant || !tenant || tenant.id !== slugTenant.id) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <LoadingBlock />
      </div>
    );
  }

  return <>{children}</>;
}
