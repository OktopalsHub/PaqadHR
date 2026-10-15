'use client';

import { useAuth } from '@/providers/auth-provider';
import { ObservabilityProvider } from '@/providers/observability-provider';

export function ObservabilityBridge({ children }: { children: React.ReactNode }) {
  const { user, analyticsDistinctId, hasResolvedSession } = useAuth();
  return (
    <ObservabilityProvider
      userId={user?.id}
      analyticsDistinctId={analyticsDistinctId}
      ready={hasResolvedSession}
    >
      {children}
    </ObservabilityProvider>
  );
}
