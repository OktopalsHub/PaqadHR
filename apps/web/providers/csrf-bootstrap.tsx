'use client';

import { useEffect } from 'react';
import { bootstrapCsrf } from '@/lib/api/client';

/** Ensures CSRF cookie/token exist before the user triggers mutations. */
export function CsrfBootstrap() {
  useEffect(() => {
    void bootstrapCsrf();

    const refresh = () => {
      void bootstrapCsrf();
    };

    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  return null;
}
