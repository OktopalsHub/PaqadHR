'use client';

import type { ReactNode } from 'react';
import { AppVersionWatcher } from '@/components/app-version-watcher';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/providers/auth-provider';
import { ObservabilityIdentity } from '@/providers/observability-bridge';
import { QueryProvider } from '@/providers/query-provider';
import { TenantProvider } from '@/providers/tenant-provider';

/**
 * Providers for authenticated and account flows (app, auth, onboarding, careers).
 *
 * Marketing and legal routes intentionally do not mount these: they hold no
 * session, tenant, or query state, and shipping them to the landing page costs
 * mobile users a session probe plus the auth/query bundles.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <ObservabilityIdentity />
        <TenantProvider>{children}</TenantProvider>
      </AuthProvider>
      <Toaster position="top-center" invert richColors closeButton />
      <AppVersionWatcher />
    </QueryProvider>
  );
}
