'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { LoadingSpinner } from '@/components/loading-block';
import { useAuth } from '@/hooks/use-auth';
import { readIdleLock } from '@/lib/auth/idle-lock';
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
  const { user, isAuthenticated, isLoading: authLoading, hasResolvedSession } = useAuth();
  const { tenants, isLoading: tenantLoading, hasResolvedTenants } = useTenant();
  const idleLocked = typeof window !== 'undefined' && Boolean(readIdleLock());

  const isLoading = authLoading || (isAuthenticated && tenantLoading);
  // Keep shell while revalidating when we already have a user (cached) or soft lock.
  const keepShell = Boolean(user) || idleLocked || isAuthenticated;

  useEffect(() => {
    if (idleLocked) return;
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
    hasResolvedTenants,
    tenants,
    pathname,
    router,
    idleLocked,
  ]);

  if (idleLocked) {
    return <>{children}</>;
  }

  if (!keepShell && (isLoading || !hasResolvedSession || !hasResolvedTenants)) {
    return <LoadingSpinner />;
  }

  if (hasResolvedSession && !isAuthenticated) {
    return <LoadingSpinner />;
  }

  if (keepShell && (!hasResolvedSession || !hasResolvedTenants)) {
    return <>{children}</>;
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
