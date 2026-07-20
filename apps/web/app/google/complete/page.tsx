'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { LoadingBlock } from '@/components/loading-block';
import {
  loadUserTenantsWithRetry,
  persistUserSession,
  waitForAuthenticatedProfile,
} from '@/lib/api/auth';
import { bootstrapCsrf } from '@/lib/api/client';
import {
  goToAuthDestination,
  resolveAuthDestination,
} from '@/lib/navigation/resolve-auth-destination';
import { queryKeys } from '@/lib/query/keys';
import { persistTenantId, persistTenantSlug } from '@/lib/session';
import { ForceLightTheme } from '@/providers/force-light-theme';

export default function GoogleCompletePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      await bootstrapCsrf();

      const profile = await waitForAuthenticatedProfile();
      if (!profile) {
        router.replace('/signin?error=google');
        return;
      }

      const tenants = await loadUserTenantsWithRetry();
      const needsOnboarding = tenants.length === 0;
      const user = persistUserSession(profile, needsOnboarding);

      queryClient.setQueryData(queryKeys.auth.session, user);
      queryClient.setQueryData(queryKeys.tenants.all, tenants);

      if (tenants.length > 0) {
        const active = tenants.find((item) => item.isActive) ?? tenants[0];
        persistTenantId(active.id);
        if (active.slug) persistTenantSlug(active.slug);
      }

      const destination = resolveAuthDestination({
        isAuthenticated: true,
        tenants,
      });
      goToAuthDestination(destination, router.replace);
    })();
  }, [queryClient, router]);

  return (
    <ForceLightTheme className="flex min-h-screen items-center justify-center">
      <LoadingBlock />
    </ForceLightTheme>
  );
}
