'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { LoadingBlock } from '@/components/loading-block';
import { getSession } from '@/lib/api/auth';
import { bootstrapCsrf } from '@/lib/api/client';
import { fetchUserTenants } from '@/lib/api/tenants';
import {
  authDestinationToPath,
  resolveAuthDestination,
} from '@/lib/navigation/resolve-auth-destination';
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
      try {
        await bootstrapCsrf();
        const user = await getSession();
        if (!user) {
          router.replace('/signin?error=google');
          return;
        }

        queryClient.setQueryData(queryKeys.auth.session, user);
        const tenants = await fetchUserTenants();
        queryClient.setQueryData(queryKeys.tenants.all, tenants);

        const destination = resolveAuthDestination({
          isAuthenticated: true,
          tenants,
        });
        router.replace(authDestinationToPath(destination));
      } catch {
        router.replace('/signin?error=google');
      }
    })();
  }, [queryClient, router]);

  return (
    <ForceLightTheme className="flex min-h-screen items-center justify-center">
      <LoadingBlock />
    </ForceLightTheme>
  );
}
