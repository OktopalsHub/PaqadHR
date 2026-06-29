'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingBlock } from '@/components/loading-block';
import { bootstrapCsrf } from '@/lib/api/client';
import {
  authDestinationToPath,
  resolveAuthDestination,
} from '@/lib/navigation/resolve-auth-destination';
import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/providers/tenant-provider';


export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { tenant, tenants, isLoading: tenantLoading, hasResolvedTenants } = useTenant();

  const isLoading = authLoading || (isAuthenticated && tenantLoading);

  useEffect(() => {
    void bootstrapCsrf();
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      router.replace(authDestinationToPath(resolveAuthDestination({ isAuthenticated: false, tenants: [] })));
      return;
    }

    if (isLoading || !hasResolvedTenants) return;

    const destination = resolveAuthDestination({ isAuthenticated: true, tenants });
    if (destination.type === 'dashboard') {
      router.replace(authDestinationToPath(destination));
    }
  }, [authLoading, isAuthenticated, isLoading, hasResolvedTenants, tenants, tenant, router]);

  if (isLoading || !hasResolvedTenants) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <LoadingBlock />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <LoadingBlock />
      </div>
    );
  }

  if (tenants.length > 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <LoadingBlock />
      </div>
    );
  }

  return <>{children}</>;
}
