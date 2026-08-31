'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { resetCorrelationId } from '@/lib/observability/correlation-id';
import { capturePageview, initPostHog, resetPostHog } from '@/lib/observability/posthog-client';

type ObservabilityProviderProps = {
  children: React.ReactNode;
  userId?: string | null;
};

export function ObservabilityProvider({ children, userId }: ObservabilityProviderProps) {
  const pathname = usePathname();

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (!userId) resetPostHog();
  }, [userId]);

  useEffect(() => {
    resetCorrelationId();
    capturePageview(pathname);
  }, [pathname]);

  return children;
}
