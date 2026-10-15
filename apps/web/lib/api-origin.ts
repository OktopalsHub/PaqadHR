const DEFAULT_LOCAL_API_URL = 'http://localhost:9001';

/** Known API origins when NEXT_PUBLIC_API_URL is missing at the edge. */
const HOST_API_FALLBACK: Record<string, string> = {
  'dev.paqadhr.com': 'https://api-dev.paqadhr.com',
  'paqadhr.com': 'https://prod.paqadhr.com',
  'www.paqadhr.com': 'https://prod.paqadhr.com',
};

const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || 'paqadhr.com';

function apiFallbackForHost(host: string): string | undefined {
  if (HOST_API_FALLBACK[host]) return HOST_API_FALLBACK[host];

  if (host.endsWith(`.dev.${APP_DOMAIN}`)) {
    return 'https://api-dev.paqadhr.com';
  }
  if (host.endsWith(`.${APP_DOMAIN}`) && host !== `www.${APP_DOMAIN}`) {
    return 'https://prod.paqadhr.com';
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
  // On known PaqadHR domains, the hostname is authoritative. This prevents a
  // stale Cloudflare Worker NEXT_PUBLIC_API_URL (preserved by --keep-vars)
  // from sending production users to the development API or vice versa.
  const hostBaseUrl = resolveHostApiBaseUrl(options?.requestHost);
  if (hostBaseUrl) return hostBaseUrl;

  const fromEnv = options?.envUrl?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  return DEFAULT_LOCAL_API_URL;
}

/**
 * API base URL derived from the request host alone, ignoring any env override.
 *
 * The client bundle resolves its API base from the same host when
 * `NEXT_PUBLIC_API_URL` is not inlined, and the Worker runtime may hold a
 * different (e.g. stale dashboard) value in `process.env`. Callers that need to
 * allow every origin the browser could actually call — CSP connect-src — use
 * this to union with the env-derived origin.
 */
export function resolveHostApiBaseUrl(requestHost?: string): string | undefined {
  const host = requestHost?.split(':')[0];
  if (!host) return undefined;
  return apiFallbackForHost(host);
}

/** CSP connect-src origin (scheme + host, no /api path). */
export function apiOriginFromBase(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/$/, '');
  if (trimmed.endsWith('/api/v1')) return trimmed.slice(0, -'/api/v1'.length);
  if (trimmed.endsWith('/api')) return trimmed.slice(0, -'/api'.length);
  return trimmed;
}
