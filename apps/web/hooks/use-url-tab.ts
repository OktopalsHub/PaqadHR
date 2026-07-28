'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { readTabParam, replaceTabInUrl } from '@/lib/navigation/tab-query';

export function useUrlTab<T extends string>(
  isValid: (tab: string | null) => tab is T,
  fallback: T,
): [T, (tab: T) => void] {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<T>(() =>
    typeof window !== 'undefined'
      ? readTabParam(window.location.search, isValid, fallback)
      : fallback,
  );

  useEffect(() => {
    const onPopState = () => {
      setActiveTab(readTabParam(window.location.search, isValid, fallback));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [isValid, fallback]);

  useEffect(() => {
    setActiveTab(readTabParam(window.location.search, isValid, fallback));
  }, [isValid, fallback]);

  const setTab = useCallback(
    (tab: T) => {
      setActiveTab((previous) => {
        replaceTabInUrl(pathname, tab, { previousTab: previous });
        return tab;
      });
    },
    [pathname],
  );

  return [activeTab, setTab];
}
