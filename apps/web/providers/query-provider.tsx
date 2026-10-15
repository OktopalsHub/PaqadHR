'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo } from 'react';
import { setQueryClientForTenants } from '@/lib/api/tenants';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
    [],
  );

  // Wire up the queryClient for tenant caching (synchronous, before any renders)
  setQueryClientForTenants(queryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
