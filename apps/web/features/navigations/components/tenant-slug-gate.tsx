'use client';

import { useParams, usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { LoadingSpinner } from '@/components/loading-block';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/hooks/use-auth';
import {
  captureAuthReturnTo,
  goToAuthDestination,
  resolveAuthDestination,
} from '@/lib/navigation/resolve-auth-destination';
import {
  isSubdomainTenantsEnabled,
  tenantRoot,
  tenantSubpathFromPathname,
  tenantUrl,
} from '@/lib/navigation/tenant-routes';
import { useTenant } from '@/providers/tenant-provider';

export function TenantSlugGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = params.tenantSlug;
  const redirectedRef = useRef(false);
  const onboardingRedirectRef = useRef(false);
  const { isAuthenticated, isLoading: authLoading, hasResolvedSession } = useAuth();
  const {
    tenant,
    tenants,
    selectTenantId,
    isLoading: tenantLoading,
    hasResolvedTenants,
  } = useTenant();

  const slugTenant = tenants.find((item) => item.slug === tenantSlug);
  const isLoading = authLoading || (isAuthenticated && tenantLoading);

  useEffect(() => {
    if (authLoading || !hasResolvedSession) return;

    if (!isAuthenticated) {
      const destination = resolveAuthDestination({
        isAuthenticated: false,
        tenants: [],
        redirect: captureAuthReturnTo(pathname),
      });
      goToAuthDestination(destination, router.replace);
      return;
    }

    if (!hasResolvedTenants) return;

    const destination = resolveAuthDestination({
      isAuthenticated: true,
      tenants,
    });
    if (destination.type === 'onboarding' && !onboardingRedirectRef.current) {
      onboardingRedirectRef.current = true;
      goToAuthDestination(destination, router.replace);
      return;
    }

    if (!slugTenant && tenants.length > 0 && !redirectedRef.current) {
      redirectedRef.current = true;
      const fallback =
        tenants.find((item) => item.id === tenant?.id) ??
        tenants.find((item) => item.isActive) ??
        tenants[0];
      if (fallback?.slug) {
        if (isSubdomainTenantsEnabled()) {
          window.location.assign(
            tenantUrl(fallback.slug, tenantSubpathFromPathname(pathname, tenantSlug)),
          );
          return;
        }
        const suffix = pathname.replace(`/${tenantSlug}`, '') || '';
        router.replace(`${tenantRoot(fallback.slug)}${suffix}`);
      }
    }
  }, [
    authLoading,
    hasResolvedSession,
    isAuthenticated,
    hasResolvedTenants,
    tenant,
    tenantSlug,
    tenants,
    slugTenant,
    pathname,
    router,
  ]);

  useEffect(() => {
    if (!slugTenant || tenant?.id === slugTenant.id) return;
    selectTenantId(slugTenant.id);
  }, [slugTenant, tenant?.id, selectTenantId]);

  if (isLoading || !hasResolvedSession || !hasResolvedTenants) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <LoadingSpinner />;
  }

  if (!slugTenant) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle>Workspace not found</AlertTitle>
          <AlertDescription>
            You don&apos;t have access to this workspace, or it doesn&apos;t exist.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!tenant || tenant.id !== slugTenant.id) {
    return <LoadingSpinner />;
  }

  return <>{children}</>;
}
