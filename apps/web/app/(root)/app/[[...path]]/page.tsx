'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { rewriteLegacyAppPath } from '@/lib/navigation/tenant-routes';
import { useTenant } from '@/providers/tenant-provider';

/** Redirect legacy `/app/*` URLs to `/{tenantSlug}/*`. */
export default function LegacyAppRedirectPage() {
  const router = useRouter();
  const params = useParams<{ path?: string[] }>();
  const { tenant, tenants, isLoading } = useTenant();

  useEffect(() => {
    if (isLoading) return;

    if (tenants.length === 0) {
      router.replace('/onboarding');
      return;
    }

    const slug = tenant?.slug ?? tenants[0]?.slug;
    if (!slug) return;

    const suffix = params.path?.length ? `/${params.path.join('/')}` : '';
    const legacyPath = `/app${suffix}`;
    router.replace(rewriteLegacyAppPath(legacyPath, slug));
  }, [isLoading, tenant, tenants, params.path, router]);

  return null;
}
