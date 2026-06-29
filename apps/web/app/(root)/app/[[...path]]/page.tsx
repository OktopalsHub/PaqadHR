'use client';

import { useParams, usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  authDestinationToPath,
  resolveAuthDestination,
} from '@/lib/navigation/resolve-auth-destination';
import { rewriteLegacyAppPath } from '@/lib/navigation/tenant-routes';
import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/providers/tenant-provider';


export default function LegacyAppRedirectPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ path?: string[] }>();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { tenant, tenants, isLoading: tenantLoading, hasResolvedTenants, isError } = useTenant();

  const isLoading = authLoading || (isAuthenticated && tenantLoading);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      const destination = resolveAuthDestination({
        isAuthenticated: false,
        tenants: [],
        redirect: pathname,
      });
      router.replace(authDestinationToPath(destination));
      return;
    }

    if (isLoading || !hasResolvedTenants || isError) return;

    const destination = resolveAuthDestination({ isAuthenticated: true, tenants });
    if (destination.type === 'onboarding') {
      router.replace(authDestinationToPath(destination));
      return;
    }

    const slug = tenant?.slug ?? tenants[0]?.slug;
    if (!slug) return;

    const suffix = params.path?.length ? `/${params.path.join('/')}` : '';
    const legacyPath = `/app${suffix}`;
    router.replace(rewriteLegacyAppPath(legacyPath, slug));
  }, [
    authLoading,
    isAuthenticated,
    isLoading,
    hasResolvedTenants,
    isError,
    tenant,
    tenants,
    params.path,
    pathname,
    router,
  ]);

  return null;
}
