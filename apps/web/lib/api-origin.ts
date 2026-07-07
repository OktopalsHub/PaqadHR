const DEFAULT_LOCAL_API_URL = 'http://localhost:9001';

/** Known API origins when NEXT_PUBLIC_API_URL is missing at the edge. */
const HOST_API_FALLBACK: Record<string, string> = {
  'dev.paqadhr.com': 'https://api-dev.paqadhr.com',
  'paqadhr.com': 'https://api.paqadhr.com',
  'www.paqadhr.com': 'https://api.paqadhr.com',
};

export function normalizeApiV1Base(url: string): string {
  const trimmed = url.replace(/\/$/, '');
  if (trimmed.endsWith('/api/v1')) return trimmed;
  if (trimmed.endsWith('/api')) return `${trimmed}/v1`;
  return `${trimmed}/api/v1`;
}

export function resolveApiBaseUrl(options?: { envUrl?: string; requestHost?: string }): string {
  const fromEnv = options?.envUrl?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const host = options?.requestHost?.split(':')[0];
  if (host && HOST_API_FALLBACK[host]) {
    return HOST_API_FALLBACK[host];
  }

  return DEFAULT_LOCAL_API_URL;
}

/** CSP connect-src origin (scheme + host, no /api path). */
export function apiOriginFromBase(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/$/, '');
  if (trimmed.endsWith('/api/v1')) return trimmed.slice(0, -'/api/v1'.length);
  if (trimmed.endsWith('/api')) return trimmed.slice(0, -'/api'.length);
  return trimmed;
}
