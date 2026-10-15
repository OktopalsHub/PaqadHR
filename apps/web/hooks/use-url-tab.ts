'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { readTabParam, replaceTabInUrl } from '@/lib/navigation/tab-query';
import { createTabUrlUpdateScheduler } from '@/lib/navigation/tab-update-scheduler';

export function useUrlTab<T extends string>(
  isValid: (tab: string | null) => tab is T,
  fallback: T,
): [T, (tab: T) => void] {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const [activeTab, setActiveTab] = useState<T>(() => readTabParam(search, isValid, fallback));
  const latestRequestedTab = useRef(activeTab);
  const pathnameRef = useRef(pathname);
  const urlUpdateScheduler = useRef<((tab: T, previousTab: T) => void) | null>(null);
  pathnameRef.current = pathname;

  if (!urlUpdateScheduler.current) {
    urlUpdateScheduler.current = createTabUrlUpdateScheduler((update) => {
      replaceTabInUrl(pathnameRef.current, update.tab, { previousTab: update.previousTab });
    });
  }

  useEffect(() => {
    const onPopState = () => {
      const tab = readTabParam(window.location.search, isValid, fallback);
      latestRequestedTab.current = tab;
      setActiveTab(tab);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [isValid, fallback]);

  useEffect(() => {
    const tab = readTabParam(search, isValid, fallback);
    latestRequestedTab.current = tab;
    setActiveTab(tab);
  }, [search, isValid, fallback]);

  const setTab = useCallback((tab: T) => {
    const previousTab = latestRequestedTab.current;
    if (tab === previousTab) return;
    latestRequestedTab.current = tab;
    setActiveTab(tab);
    urlUpdateScheduler.current?.(tab, previousTab);
  }, []);

  return [activeTab, setTab];
}
