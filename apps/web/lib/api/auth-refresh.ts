import { clearSessionStorage } from '@/lib/session';

const API_V1_BASE = (() => {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:9001';
  const trimmed = raw.replace(/\/$/, '');
  if (trimmed.endsWith('/api/v1')) return trimmed;
  if (trimmed.endsWith('/api')) return `${trimmed}/v1`;
  return `${trimmed}/api/v1`;
})();

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
      const response = await fetch(`${API_V1_BASE}/auth/refresh`, {
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
