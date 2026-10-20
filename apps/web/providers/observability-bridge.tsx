'use client';

import { useEffect } from 'react';
import { identifyPostHog, resetPostHog } from '@/lib/observability/posthog-client';
import { useAuth } from '@/providers/auth-provider';

/**
 * Binds the analytics identity to the session once the bootstrap settles.
 *
 * The pageview provider lives in the root layout so marketing visits are still
 * measured without mounting the auth/query providers.
 */
export function ObservabilityIdentity() {
  const { user, analyticsDistinctId, hasResolvedSession } = useAuth();

  useEffect(() => {
    if (!hasResolvedSession) return;
    if (user?.id && analyticsDistinctId) identifyPostHog(analyticsDistinctId);
    else resetPostHog();
  }, [hasResolvedSession, user?.id, analyticsDistinctId]);

  return null;
}
