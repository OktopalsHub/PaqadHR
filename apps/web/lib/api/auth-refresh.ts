import {
  clearCsrfToken,
  getApiV1Base,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '@/lib/api/client';
import { clearSessionStorage } from '@/lib/session';

let refreshPromise: Promise<boolean> | null = null;

export function invalidateSession() {
  clearSessionStorage();
  clearCsrfToken();
  setAccessToken(null);
  setRefreshToken(null);
}

export async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      // Send the stored refresh token in the body so refresh works even when
      // the httpOnly refresh_token cookie is a dropped third-party cookie.
      const stored = getRefreshToken();
      const response = await fetch(`${getApiV1Base()}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stored ? { refreshToken: stored } : {}),
      });
      if (!response.ok) return false;

      const data = (await response.json().catch(() => null)) as {
        accessToken?: string;
        refreshToken?: string;
      } | null;
      if (data?.accessToken) setAccessToken(data.accessToken);
      if (data?.refreshToken) setRefreshToken(data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}
