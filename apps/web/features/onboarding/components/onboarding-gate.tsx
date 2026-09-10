'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { LoadingSpinner } from '@/components/loading-block';
import { useAuth } from '@/hooks/use-auth';
import { bootstrapCsrf } from '@/lib/api/client';
import {
  goToAuthDestination,
  resolveAuthDestination,
} from '@/lib/navigation/resolve-auth-destination';
import { useTenant } from '@/providers/tenant-provider';

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const dashboardRedirectRef = useRef(false);
  const { isAuthenticated, isLoading: authLoading, hasResolvedSession } = useAuth();
  const { tenants, isLoading: tenantLoading, hasResolvedTenants } = useTenant();

  const isLoading = authLoading || (isAuthenticated && tenantLoading);

  useEffect(() => {
    void bootstrapCsrf();
  }, []);

  useEffect(() => {
    if (authLoading || !hasResolvedSession) return;

    if (!isAuthenticated) {
      goToAuthDestination(
        resolveAuthDestination({ isAuthenticated: false, tenants: [] }),
        router.replace,
      );
      return;
    }

    if (!hasResolvedTenants) return;

    const destination = resolveAuthDestination({
      isAuthenticated: true,
      tenants,
    });
    if (destination.type === 'dashboard' && !dashboardRedirectRef.current) {
      dashboardRedirectRef.current = true;
      goToAuthDestination(destination, router.replace);
    }
  }, [authLoading, hasResolvedSession, isAuthenticated, hasResolvedTenants, tenants, router]);

  if (isLoading || !hasResolvedSession || !hasResolvedTenants) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <LoadingSpinner />;
  }

  if (tenants.length > 0) {
    return <LoadingSpinner />;
  }

  return <>{children}</>;
}
