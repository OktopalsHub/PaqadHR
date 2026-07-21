'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { LoadingBlock } from '@/components/loading-block';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/hooks/use-auth';
import { loadUserTenantsWithRetry } from '@/lib/api/auth';
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
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';

export function TenantSlugGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = params.tenantSlug;
  const redirectedRef = useRef(false);
  const onboardingRedirectRef = useRef(false);
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const {
    tenant,
    tenants,
    selectTenantId,
    isLoading: tenantLoading,
    hasResolvedTenants,
    isError,
  } = useTenant();

  const slugTenant = tenants.find((item) => item.slug === tenantSlug);
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

    void (async () => {
      let resolvedTenants = tenants;
      if (resolvedTenants.length === 0) {
        resolvedTenants = await loadUserTenantsWithRetry({ attempts: 6, baseDelayMs: 200 });
        if (resolvedTenants.length > 0) {
          queryClient.setQueryData(queryKeys.tenants.all, resolvedTenants);
        }
      }

      const destination = resolveAuthDestination({
        isAuthenticated: true,
        tenants: resolvedTenants,
      });
      if (destination.type === 'onboarding' && !onboardingRedirectRef.current) {
        onboardingRedirectRef.current = true;
        goToAuthDestination(destination, router.replace);
        return;
      }

      const matchedTenant = resolvedTenants.find((item) => item.slug === tenantSlug);
      if (!matchedTenant && resolvedTenants.length > 0 && !redirectedRef.current) {
        redirectedRef.current = true;
        const fallback =
          resolvedTenants.find((item) => item.id === tenant?.id) ??
          resolvedTenants.find((item) => item.isActive) ??
          resolvedTenants[0];
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
    })();
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
    queryClient,
  ]);

  useEffect(() => {
    if (!slugTenant || tenant?.id === slugTenant.id) return;
    selectTenantId(slugTenant.id);
  }, [slugTenant, tenant?.id, selectTenantId]);

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
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <LoadingBlock />
      </div>
    );
  }

  return <>{children}</>;
}
