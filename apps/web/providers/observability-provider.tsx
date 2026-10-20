'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { captureAttribution } from '@/lib/observability/attribution';
import { resetCorrelationId } from '@/lib/observability/correlation-id';
import {
  capturePageview,
  initPostHog,
  registerAttribution,
} from '@/lib/observability/posthog-client';

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

/**
 * Marketing-safe analytics. It owns anonymous pageviews for every route, but
 * never mounts auth/tenant/query state. Signed-in identity is attached later by
 * `ObservabilityIdentity` inside `AppProviders`.
 */
export function ObservabilityProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    // Queue attribution before the first pageview, then load PostHog when the
    // browser is idle so it never competes with first paint.
    const attribution = captureAttribution();
    registerAttribution(attribution);

    const idleWindow = window as IdleWindow;
    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(() => initPostHog(), { timeout: 3000 });
      return () => idleWindow.cancelIdleCallback?.(handle);
    }

    const timer = window.setTimeout(() => initPostHog(), 1500);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    resetCorrelationId();
    capturePageview(pathname);
  }, [pathname]);

  return children;
}
