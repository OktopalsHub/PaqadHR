'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { readTabParam, replaceTabInUrl } from '@/lib/navigation/tab-query';

export function useUrlTab<T extends string>(
  isValid: (tab: string | null) => tab is T,
  fallback: T,
): [T, (tab: T) => void] {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const [activeTab, setActiveTab] = useState<T>(() => readTabParam(search, isValid, fallback));
  const previousTab = useRef(activeTab);
  const urlUpdateQueued = useRef(false);

  useEffect(() => {
    const onPopState = () => {
      const tab = readTabParam(window.location.search, isValid, fallback);
      setActiveTab(tab);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [isValid, fallback]);

  useEffect(() => {
    setActiveTab(readTabParam(search, isValid, fallback));
  }, [search, isValid, fallback]);

  const setTab = useCallback(
    (tab: T) => {
      if (tab === activeTab) return;
      previousTab.current = activeTab;
      setActiveTab(tab);
      urlUpdateQueued.current = true;
      queueMicrotask(() => {
        if (!urlUpdateQueued.current) return;
        replaceTabInUrl(pathname, tab, { previousTab: previousTab.current });
        urlUpdateQueued.current = false;
      });
    },
    [activeTab, pathname],
  );

  return [activeTab, setTab];
}
