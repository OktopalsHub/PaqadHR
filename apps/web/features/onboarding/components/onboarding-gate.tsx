'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingBlock } from '@/components/loading-block';
import { tenantRoot } from '@/lib/navigation/tenant-routes';
import { useTenant } from '@/providers/tenant-provider';

/** Skip setup when the user already has a workspace. */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { tenant, tenants, isLoading } = useTenant();

  useEffect(() => {
    if (isLoading) return;
    if (tenants.length > 0 && tenant?.slug) {
      router.replace(tenantRoot(tenant.slug));
    }
  }, [isLoading, tenant, tenants.length, router]);

  if (isLoading || tenants.length > 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <LoadingBlock />
      </div>
    );
  }

  return <>{children}</>;
}
