'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  isStaleChunkError,
  markChunkReloadAttempted,
  shouldReloadForChunkError,
} from '@/lib/app-version/chunk-reload';

const POLL_MS = 5 * 60_000;
const DISMISSED_KEY = 'paqadhr-version-dismissed';

function getInitialBuildId(): string {
  return process.env.NEXT_PUBLIC_APP_BUILD_ID?.trim() || 'dev';
}

async function fetchRemoteBuildId(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { buildId?: string };
    return typeof data.buildId === 'string' ? data.buildId : null;
  } catch {
    return null;
  }
}

function showUpdateToast(onDismiss?: () => void) {
  toast('New version available', {
    description: 'Refresh to get the latest updates.',
    duration: Number.POSITIVE_INFINITY,
    action: {
      label: 'Refresh',
      onClick: () => window.location.reload(),
    },
    onDismiss,
  });
}

export function AppVersionWatcher() {
  const initialBuildId = getInitialBuildId();
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') return;

    const checkVersion = async () => {
      const remoteBuildId = await fetchRemoteBuildId();
      if (!remoteBuildId || remoteBuildId === initialBuildId) return;

      const dismissed = sessionStorage.getItem(DISMISSED_KEY);
      if (dismissed === remoteBuildId || notifiedRef.current) return;

      notifiedRef.current = true;
      showUpdateToast(() => {
        sessionStorage.setItem(DISMISSED_KEY, remoteBuildId);
        notifiedRef.current = false;
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void checkVersion();
    };

    void checkVersion();
    const interval = window.setInterval(() => void checkVersion(), POLL_MS);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [initialBuildId]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') return;

    const handleChunkFailure = (error: unknown) => {
      if (!isStaleChunkError(error)) return;

      Sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
        tags: { stale_chunk: 'true' },
      });

      if (shouldReloadForChunkError(initialBuildId)) {
        markChunkReloadAttempted(initialBuildId);
        window.location.reload();
        return;
      }

      if (!notifiedRef.current) {
        notifiedRef.current = true;
        showUpdateToast(() => {
          notifiedRef.current = false;
        });
      }
    };

    const onError = (event: ErrorEvent) => {
      handleChunkFailure(event.error ?? event.message);
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      handleChunkFailure(event.reason);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [initialBuildId]);

  return null;
}
