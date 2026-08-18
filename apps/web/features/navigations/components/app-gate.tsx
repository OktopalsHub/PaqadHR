'use client';

import { useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { LoadingBlock, LoadingSpinner } from '@/components/loading-block';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/hooks/use-auth';
import { loadUserTenantsWithRetry } from '@/lib/api/auth';
import {
  captureAuthReturnTo,
  goToAuthDestination,
  resolveAuthDestination,
} from '@/lib/navigation/resolve-auth-destination';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';

export function AppGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const onboardingRedirectRef = useRef(false);
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { tenants, isLoading: tenantLoading, hasResolvedTenants, isError } = useTenant();

  const isLoading = authLoading || (isAuthenticated && tenantLoading);

  useEffect(() => {
    if (authLoading) return;

    // During sign-out, the session is torn down before the full-page redirect
    // fires. Skip capturing a redirect param so the signin URL stays clean.
    const signingOut =
      typeof window !== 'undefined' && sessionStorage.getItem('auth_signing_out') === '1';
    if (signingOut) {
      sessionStorage.removeItem('auth_signing_out');
      return;
    }

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
        resolvedTenants = await loadUserTenantsWithRetry({ attempts: 2, baseDelayMs: 100 });
        if (resolvedTenants.length > 0) {
          queryClient.setQueryData(queryKeys.tenants.all, resolvedTenants);
          return;
        }
      }

      const destination = resolveAuthDestination({
        isAuthenticated: true,
        tenants: resolvedTenants,
      });
      if (destination.type === 'onboarding' && !onboardingRedirectRef.current) {
        onboardingRedirectRef.current = true;
        goToAuthDestination(destination, router.replace);
      }
    })();
  }, [
    authLoading,
    isAuthenticated,
    tenantLoading,
    hasResolvedTenants,
    isError,
    tenants,
    pathname,
    router,
    queryClient,
  ]);

  if (isLoading || !hasResolvedTenants) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <LoadingSpinner />;
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

  if (tenants.length === 0) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <LoadingBlock />
      </div>
    );
  }

  return <>{children}</>;
}
