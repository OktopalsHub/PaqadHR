'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { LoadingSpinner } from '@/components/loading-block';
import { useAuth } from '@/hooks/use-auth';
import { loadUserTenantsWithRetry } from '@/lib/api/auth';
import { bootstrapCsrf } from '@/lib/api/client';
import {
  goToAuthDestination,
  resolveAuthDestination,
} from '@/lib/navigation/resolve-auth-destination';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const dashboardRedirectRef = useRef(false);
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { tenants, isLoading: tenantLoading, hasResolvedTenants } = useTenant();

  const isLoading = authLoading || (isAuthenticated && tenantLoading);

  useEffect(() => {
    void bootstrapCsrf();
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      goToAuthDestination(
        resolveAuthDestination({ isAuthenticated: false, tenants: [] }),
        router.replace,
      );
      return;
    }

    if (isLoading || !hasResolvedTenants) return;

    void (async () => {
      let resolvedTenants = tenants;
      if (resolvedTenants.length === 0) {
        resolvedTenants = await loadUserTenantsWithRetry({ attempts: 2, baseDelayMs: 100 });
        if (resolvedTenants.length > 0) {
          queryClient.setQueryData(queryKeys.tenants.all, resolvedTenants);
        }
      }

      const destination = resolveAuthDestination({
        isAuthenticated: true,
        tenants: resolvedTenants,
      });
      if (destination.type === 'dashboard' && !dashboardRedirectRef.current) {
        dashboardRedirectRef.current = true;
        goToAuthDestination(destination, router.replace);
      }
    })();
  }, [authLoading, isAuthenticated, isLoading, hasResolvedTenants, tenants, router, queryClient]);

  if (isLoading || !hasResolvedTenants) {
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
