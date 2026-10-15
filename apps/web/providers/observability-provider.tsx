'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { resetCorrelationId } from '@/lib/observability/correlation-id';
import {
  capturePageview,
  identifyPostHog,
  initPostHog,
  resetPostHog,
} from '@/lib/observability/posthog-client';

type ObservabilityProviderProps = {
  children: React.ReactNode;
  userId?: string | null;
  /** Salted id the API reports for the signed-in user; null when analytics is off. */
  analyticsDistinctId?: string | null;
  /** Only act on identity once the session bootstrap has settled. */
  ready?: boolean;
};

export function ObservabilityProvider({
  children,
  userId,
  analyticsDistinctId,
  ready = false,
}: ObservabilityProviderProps) {
  const pathname = usePathname();

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (userId && analyticsDistinctId) identifyPostHog(analyticsDistinctId);
    else resetPostHog();
  }, [ready, userId, analyticsDistinctId]);

  useEffect(() => {
    resetCorrelationId();
    capturePageview(pathname);
  }, [pathname]);

  return children;
}
