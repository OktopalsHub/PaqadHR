'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { LoadingBlock } from '@/components/loading-block';
import { applySessionBootstrap, waitForSessionBootstrap } from '@/lib/api/auth';
import { bootstrapCsrf } from '@/lib/api/client';
import { cacheKeys, MAX_CACHE_TTL, setCached } from '@/lib/cache';
import { goToHref, resolvePostAuthHref } from '@/lib/navigation/resolve-post-auth-href';
import { queryKeys } from '@/lib/query/keys';
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

      const bootstrap = await waitForSessionBootstrap();
      if (!bootstrap) {
        router.replace('/signin?error=google');
        return;
      }

      applySessionBootstrap(bootstrap);
      setCached(cacheKeys.auth.session, bootstrap, { ttl: MAX_CACHE_TTL });
      queryClient.setQueryData(queryKeys.auth.session, bootstrap);
      queryClient.setQueryData(queryKeys.tenants.all, bootstrap.workspaces);

      const href = await resolvePostAuthHref({
        tenants: bootstrap.workspaces,
        paymentsEnabled: bootstrap.paymentsEnabled,
      });
      goToHref(href, router.replace);
    })();
  }, [queryClient, router]);

  return (
    <ForceLightTheme className="flex min-h-screen items-center justify-center">
      <LoadingBlock />
    </ForceLightTheme>
  );
}
