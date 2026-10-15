const DEFAULT_LOCAL_API_URL = 'http://localhost:9001';

/** Known API origins when NEXT_PUBLIC_API_URL is missing at the edge. */
const HOST_API_FALLBACK: Record<string, string> = {
  'dev.paqadhr.com': 'https://api-dev.paqadhr.com',
  'paqadhr.com': 'https://api.paqadhr.com',
  'www.paqadhr.com': 'https://api.paqadhr.com',
};

const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || 'paqadhr.com';

function apiFallbackForHost(host: string): string | undefined {
  if (HOST_API_FALLBACK[host]) return HOST_API_FALLBACK[host];

  if (host.endsWith(`.dev.${APP_DOMAIN}`)) {
    return 'https://api-dev.paqadhr.com';
  }
  if (host.endsWith(`.${APP_DOMAIN}`) && host !== `www.${APP_DOMAIN}`) {
    return 'https://api.paqadhr.com';
  }
  if (host.endsWith('.localhost')) {
    return DEFAULT_LOCAL_API_URL;
  }

  return undefined;
}

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
  if (host) {
    const fallback = apiFallbackForHost(host);
    if (fallback) return fallback;
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
