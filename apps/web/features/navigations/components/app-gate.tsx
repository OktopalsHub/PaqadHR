'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingBlock } from '@/components/loading-block';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/hooks/use-auth';
import {
  captureAuthReturnTo,
  goToAuthDestination,
  resolveAuthDestination,
} from '@/lib/navigation/resolve-auth-destination';
import { useTenant } from '@/providers/tenant-provider';

export function AppGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { tenants, isLoading: tenantLoading, hasResolvedTenants, isError } = useTenant();

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
    }
  }, [
    authLoading,
    isAuthenticated,
    tenantLoading,
    hasResolvedTenants,
    isError,
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

  if (tenants.length === 0) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <LoadingBlock />
      </div>
    );
  }

  return <>{children}</>;
}
