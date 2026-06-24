import { clearSessionStorage } from '@/lib/session';
import { clearCsrfToken, getApiV1Base } from '@/lib/api/client';

let refreshPromise: Promise<boolean> | null = null;

/** Clears client-side session state; httpOnly cookies require logout/refresh failure on server. */
export function invalidateSession() {
  clearSessionStorage();
  clearCsrfToken();
}

export async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${getApiV1Base()}/auth/refresh`, {
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
