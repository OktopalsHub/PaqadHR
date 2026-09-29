'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  isStaleChunkError,
  markChunkReloadAttempted,
  shouldReloadForChunkError,
} from '@/lib/app-version/chunk-reload';
import { parseVersionBuildId } from '@/lib/app-version/parse-version';
import { decideUpdateFlow } from '@/lib/app-version/update-prompt';
import {
  markVersionReloadAttempted,
  shouldReloadForVersion,
} from '@/lib/app-version/version-reload';

const POLL_MS = 5 * 60_000;
const UPDATE_TOAST_ID = 'paqadhr-new-version';

function getInitialBuildId(): string {
  return process.env.NEXT_PUBLIC_APP_BUILD_ID?.trim() || 'dev';
}

async function fetchRemoteBuildId(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return parseVersionBuildId(await res.json());
  } catch {
    return null;
  }
}

function reloadIfMarked(mark: () => boolean): void {
  if (mark()) {
    window.location.reload();
  }
}

function showUpdatePrompt(): void {
  toast.info('A new version is ready', {
    id: UPDATE_TOAST_ID,
    duration: Infinity,
    description: 'Refresh when it suits you — nothing changes until you do.',
    action: {
      label: 'Refresh',
      onClick: () => window.location.reload(),
    },
  });
}

export function AppVersionWatcher() {
  const initialBuildId = getInitialBuildId();
  const promptedBuildIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') return;

    const applyUpdate = (remoteBuildId: string) => {
      const flow = decideUpdateFlow({
        remoteBuildId,
        promptedBuildId: promptedBuildIdRef.current,
        isVisible: document.visibilityState === 'visible',
      });

      if (flow === 'prompt') {
        promptedBuildIdRef.current = remoteBuildId;
        showUpdatePrompt();
        return;
      }

      if (flow === 'silentReload' && shouldReloadForVersion(remoteBuildId)) {
        reloadIfMarked(() => markVersionReloadAttempted(remoteBuildId));
      }
    };

    const checkVersion = async () => {
      const remoteBuildId = await fetchRemoteBuildId();
      if (!remoteBuildId || remoteBuildId === initialBuildId) return;
      applyUpdate(remoteBuildId);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void checkVersion();
      }
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
      if (!shouldReloadForChunkError(initialBuildId)) return;
      reloadIfMarked(() => markChunkReloadAttempted(initialBuildId));
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
