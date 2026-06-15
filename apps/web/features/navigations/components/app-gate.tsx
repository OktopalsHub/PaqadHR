'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingBlock } from '@/components/loading-block';
import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/providers/tenant-provider';

/** Redirect to workspace setup when the user has no tenant yet. */
export function AppGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isLoading: authLoading } = useAuth();
  const { tenants, isLoading: tenantLoading } = useTenant();

  useEffect(() => {
    if (authLoading || tenantLoading) return;
    if (tenants.length === 0) {
      router.replace('/onboarding');
    }
  }, [authLoading, tenantLoading, tenants.length, router]);

  if (authLoading || tenantLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <LoadingBlock />
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
