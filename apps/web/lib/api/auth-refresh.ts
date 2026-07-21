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

export function invalidateSession() {
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
      return response.ok;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}
