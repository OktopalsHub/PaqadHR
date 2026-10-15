import axios from 'axios';
import { normalizeApiV1Base, resolveApiBaseUrl } from '@/lib/api-origin';
import { isPublicAuthOrMarketingPath } from '@/lib/navigation/public-routes';
import { authPageUrl } from '@/lib/navigation/tenant-routes';
import { clearSessionStorage } from '@/lib/session';
import { API_REQUEST_TIMEOUT_MS } from './request-timeout';

function resolveApiV1Base(): string {
  return normalizeApiV1Base(
    resolveApiBaseUrl(
      typeof window !== 'undefined' ? { requestHost: window.location.hostname } : undefined,
    ),
  );
}

let refreshPromise: Promise<boolean> | null = null;
let proactiveTimer: ReturnType<typeof setInterval> | null = null;
let consecutiveFailures = 0;
let refreshPaused = false;
const MAX_CONSECUTIVE_FAILURES = 3;
const PROACTIVE_REFRESH_INTERVAL_MS = 12 * 60 * 1000;

let visibilityHandler: (() => void) | null = null;
let onRefreshSuccess: (() => void) | null = null;

export function setRefreshCallbacks(callbacks: { onSuccess?: () => void }): void {
  onRefreshSuccess = callbacks.onSuccess ?? null;
}

export function isAuthRefreshPaused(): boolean {
  return refreshPaused;
}

/** Soft idle lock: stop silent refresh so access stays cleared until unlock. */
export function pauseAuthRefresh(): void {
  refreshPaused = true;
  stopProactiveRefresh();
}

export function resumeAuthRefresh(): void {
  refreshPaused = false;
  consecutiveFailures = 0;
}

export function invalidateSession() {
  stopProactiveRefresh();
  clearSessionStorage();
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('paqad_access_token');
    window.localStorage.removeItem('paqad_refresh_token');
  }
}

/** Exported for tests — whether refresh expiry should hard-navigate to sign-in. */
export function shouldHardRedirectOnRefreshExpiry(pathname: string): boolean {
  return !isPublicAuthOrMarketingPath(pathname);
}

function handleRefreshExpired(): void {
  stopProactiveRefresh();
  invalidateSession();
  consecutiveFailures = 0;

  if (typeof window === 'undefined') return;

  const pathname = window.location.pathname;
  if (!shouldHardRedirectOnRefreshExpiry(pathname)) {
    return;
  }

  window.location.assign(authPageUrl('/signin'));
}

export async function refreshAccessToken(options?: {
  /** When true, a failure does not increment toward hard logout (session probe soft path). */
  softFail?: boolean;
}): Promise<boolean> {
  if (refreshPaused) return false;
  if (refreshPromise) return refreshPromise;

  const softFail = options?.softFail === true;

  refreshPromise = (async () => {
    try {
      const response = await axios.post(
        `${resolveApiV1Base()}/auth/refresh`,
        {},
        {
          timeout: API_REQUEST_TIMEOUT_MS,
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' },
        },
      );
      if (response.status >= 200 && response.status < 300) {
        consecutiveFailures = 0;
        onRefreshSuccess?.();
        return true;
      }
      if (!softFail) {
        consecutiveFailures++;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          handleRefreshExpired();
        }
      }
      return false;
    } catch {
      if (!softFail) {
        consecutiveFailures++;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          handleRefreshExpired();
        }
      }
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Proactively refresh the access token before it expires.
 * Called on a 12-minute interval (token expires in 15 min).
 */
async function proactiveRefresh(): Promise<void> {
  if (refreshPaused) return;
  const success = await refreshAccessToken();
  if (!success && consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    stopProactiveRefresh();
  }
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'visible') {
    void refreshAccessToken();
  }
}

export function startProactiveRefresh(): void {
  if (typeof window === 'undefined') return;
  if (refreshPaused) return;
  if (proactiveTimer !== null) return; // Already running — don't reset
  proactiveTimer = setInterval(() => {
    void proactiveRefresh();
  }, PROACTIVE_REFRESH_INTERVAL_MS);

  if (!visibilityHandler) {
    visibilityHandler = onVisibilityChange;
    document.addEventListener('visibilitychange', visibilityHandler);
  }
}

export function stopProactiveRefresh(): void {
  if (proactiveTimer !== null) {
    clearInterval(proactiveTimer);
    proactiveTimer = null;
  }
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
}

export function resetConsecutiveFailures(): void {
  consecutiveFailures = 0;
}
