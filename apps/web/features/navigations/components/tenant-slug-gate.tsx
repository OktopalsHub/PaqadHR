'use client';

import { useParams, usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingBlock } from '@/components/loading-block';
import { tenantRoot } from '@/lib/navigation/tenant-routes';
import { useTenant } from '@/providers/tenant-provider';

/** Ensures the URL tenant slug matches the active workspace. */
export function TenantSlugGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = params.tenantSlug;
  const { tenant, tenants, isLoading } = useTenant();

  useEffect(() => {
    if (isLoading) return;

    if (tenants.length === 0) {
      router.replace('/onboarding');
      return;
    }

    if (tenant && tenant.slug !== tenantSlug) {
      const suffix = pathname.replace(`/${tenantSlug}`, '') || '';
      router.replace(`${tenantRoot(tenant.slug)}${suffix}`);
    }
  }, [isLoading, tenant, tenantSlug, tenants.length, pathname, router]);

  if (isLoading || tenants.length === 0 || !tenant || tenant.slug !== tenantSlug) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <LoadingBlock />
      </div>
    );
  }

  return <>{children}</>;
}
