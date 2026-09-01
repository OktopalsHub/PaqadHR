'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { LoadingSpinner } from '@/components/loading-block';
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
  const onboardingRedirectRef = useRef(false);
  const { isAuthenticated, isLoading: authLoading, hasResolvedSession } = useAuth();
  const { tenants, isLoading: tenantLoading, hasResolvedTenants } = useTenant();

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
    }
  }, [
    authLoading,
    hasResolvedSession,
    isAuthenticated,
    tenantLoading,
    hasResolvedTenants,
    tenants,
    pathname,
    router,
  ]);

  if (isLoading || !hasResolvedSession || !hasResolvedTenants) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <LoadingSpinner />;
  }

  if (tenants.length === 0) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <LoadingSpinner />
      </div>
    );
  }

  return <>{children}</>;
}
