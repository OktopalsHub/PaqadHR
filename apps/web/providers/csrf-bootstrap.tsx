'use client';

import { useEffect } from 'react';
import { bootstrapCsrf } from '@/lib/api/client';
import { skipsSessionBootstrap } from '@/lib/navigation/public-routes';

/** Ensures CSRF cookie/token exist before the user triggers mutations.
 * Skips public marketing routes to avoid blocking FCP with an extra fetch.
 */
export function CsrfBootstrap() {
  useEffect(() => {
    const pathname = window.location.pathname;
    if (skipsSessionBootstrap(pathname)) return;

    const schedule = (cb: () => void): number => {
      const w = window as unknown as {
        requestIdleCallback?: (cb: () => void) => number;
      };
      if (typeof w.requestIdleCallback === 'function') {
        return w.requestIdleCallback(cb);
      }
      return window.setTimeout(cb, 1000) as unknown as number;
    };

    const cancel = (id: number): void => {
      const w = window as unknown as {
        cancelIdleCallback?: (id: number) => void;
      };
      if (typeof w.cancelIdleCallback === 'function') {
        w.cancelIdleCallback(id);
        return;
      }
      window.clearTimeout(id);
    };

    const id = schedule(() => {
      void bootstrapCsrf();
    });

    const refresh = () => {
      void bootstrapCsrf();
    };

    window.addEventListener('focus', refresh);
    return () => {
      cancel(id);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  return null;
}
