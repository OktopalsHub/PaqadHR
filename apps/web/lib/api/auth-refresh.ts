import { normalizeApiV1Base, resolveApiBaseUrl } from '@/lib/api-origin';
import { clearSessionStorage } from '@/lib/session';

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
const MAX_CONSECUTIVE_FAILURES = 3;
const PROACTIVE_REFRESH_INTERVAL_MS = 12 * 60 * 1000; // 12 minutes (token expires in 15)

export function invalidateSession() {
  stopProactiveRefresh();
  clearSessionStorage();
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('paqad_access_token');
    window.localStorage.removeItem('paqad_refresh_token');
  }
}

export async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${resolveApiV1Base()}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (response.ok) {
        consecutiveFailures = 0;
        return true;
      }
      consecutiveFailures++;
      return false;
    } catch {
      consecutiveFailures++;
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
  const success = await refreshAccessToken();
  if (!success && consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    stopProactiveRefresh();
  }
}

export function startProactiveRefresh(): void {
  if (typeof window === 'undefined') return;
  if (proactiveTimer !== null) return; // Already running — don't reset
  proactiveTimer = setInterval(() => {
    void proactiveRefresh();
  }, PROACTIVE_REFRESH_INTERVAL_MS);
}

export function stopProactiveRefresh(): void {
  if (proactiveTimer !== null) {
    clearInterval(proactiveTimer);
    proactiveTimer = null;
  }
}

export function resetConsecutiveFailures(): void {
  consecutiveFailures = 0;
}
