'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import type { BrandMode } from '@/lib/brand';

export function useBrandMode(): BrandMode {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return 'light';
  }

  return resolvedTheme === 'dark' ? 'dark' : 'light';
}
