'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { getNetworkActivitySnapshot, subscribeToNetworkActivity } from '@/lib/network-activity';

const getServerSnapshot = () => false;
const DISPLAY_DELAY_MS = 250;

export function NetworkActivityIndicator() {
  const isActive = useSyncExternalStore(
    subscribeToNetworkActivity,
    getNetworkActivitySnapshot,
    getServerSnapshot,
  );
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setIsVisible(false);
      return;
    }

    const displayTimer = window.setTimeout(() => {
      setIsVisible(true);
    }, DISPLAY_DELAY_MS);

    return () => window.clearTimeout(displayTimer);
  }, [isActive]);

  if (!isVisible) return null;

  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-primary/15"
      role="status"
    >
      <div className="h-full w-2/5 animate-pulse rounded-full bg-primary" />
      <span className="sr-only">Loading latest information</span>
    </div>
  );
}
