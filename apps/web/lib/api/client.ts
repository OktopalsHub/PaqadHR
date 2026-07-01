import { invalidateSession, refreshAccessToken } from '@/lib/api/auth-refresh';

const RAW_API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:9001/api/v1';

function normalizeApiV1Base(url: string): string {
  const trimmed = url.replace(/\/$/, '');
  if (trimmed.endsWith('/api/v1')) return trimmed;
  if (trimmed.endsWith('/api')) return `${trimmed}/v1`;
  return `${trimmed}/api/v1`;
}

const API_V1_BASE = normalizeApiV1Base(RAW_API_BASE);

const CSRF_HEADER = 'x-csrf-token';

let csrfToken: string | null = null;
let csrfTokenPromise: Promise<string> | null = null;

const ACCESS_TOKEN_KEY = 'paqad_access_token';
const REFRESH_TOKEN_KEY = 'paqad_refresh_token';

// ponytail: on a split-domain deployment (web on Cloudflare, API on Dokploy)
// the API's httpOnly auth cookies are third-party and get dropped by the
// browser, so cookie-only auth fails ("user not authenticated") even though it
// works on localhost where both share the same host. We also keep the JWTs the
// API returns in the response body and send them as `Authorization: Bearer`
// (the API's jwt.strategy already accepts cookie OR Bearer). Tradeoff:
// localStorage is XSS-readable; upgrade path is a shared parent-domain cookie
// once web + API live under one registrable domain.
let accessToken: string | null =
  typeof window !== 'undefined' ? window.localStorage.getItem(ACCESS_TOKEN_KEY) : null;
let refreshTokenValue: string | null =
  typeof window !== 'undefined' ? window.localStorage.getItem(REFRESH_TOKEN_KEY) : null;

function writeToken(key: string, value: string | null) {
  if (typeof window === 'undefined') return;
  if (value) window.localStorage.setItem(key, value);
  else window.localStorage.removeItem(key);
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  writeToken(ACCESS_TOKEN_KEY, token);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setRefreshToken(token: string | null) {
  refreshTokenValue = token;
  writeToken(REFRESH_TOKEN_KEY, token);
}

export function getRefreshToken(): string | null {
  return refreshTokenValue;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getApiV1Base() {
  return API_V1_BASE;
}

export function getApiOrigin() {
  return API_V1_BASE.replace(/\/api\/v1$/, '');
}

export function tenantPath(tenantId: string, path = '') {
  const suffix = path.startsWith('/') ? path : path ? `/${path}` : '';
  return `/tenants/${tenantId}${suffix}`;
}

function isCsrfError(status: number, payload: unknown): boolean {
  if (status !== 403) return false;
  if (!payload || typeof payload !== 'object') return false;
  const message = String((payload as { message?: string }).message ?? '').toLowerCase();
  return message.includes('csrf');
}

export async function ensureCsrfToken(force = false): Promise<string> {
  if (!force && csrfToken) return csrfToken;
  if (!force && csrfTokenPromise) return csrfTokenPromise;

  csrfTokenPromise = (async () => {
    const response = await fetch(`${getApiOrigin()}/csrf/token`, {
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new ApiError('Failed to fetch CSRF token', response.status);
    }

    const data = (await response.json()) as { csrfToken: string };
    if (!data.csrfToken) {
      throw new ApiError('CSRF token missing in response', response.status);
    }

    csrfToken = data.csrfToken;
    return csrfToken;
  })();

  try {
    return await csrfTokenPromise;
  } finally {
    csrfTokenPromise = null;
  }
}

export async function bootstrapCsrf(): Promise<void> {
  try {
    await ensureCsrfToken(true);
  } catch {}
}

export function clearCsrfToken() {
  csrfToken = null;
  csrfTokenPromise = null;
}

type ApiClientOptions = RequestInit & {
  skipCsrf?: boolean;
};

const AUTH_PATHS_WITHOUT_REFRESH = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/forgot-password',
];

function shouldAttemptAuthRefresh(path: string): boolean {
  return !AUTH_PATHS_WITHOUT_REFRESH.some((prefix) => path.startsWith(prefix));
}

async function parseErrorPayload(response: Response) {
  return response.json().catch(() => null);
}

export async function fetchWithCsrf(
  url: string,
  init?: RequestInit & { skipCsrf?: boolean },
): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const needsCsrf = !init?.skipCsrf && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  const headers = new Headers(init?.headers);
  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  if (needsCsrf) {
    headers.set(CSRF_HEADER, await ensureCsrfToken());
  }

  let response = await fetch(url, {
    ...init,
    method,
    credentials: 'include',
    headers,
  });

  if (needsCsrf && isCsrfError(response.status, await parseErrorPayload(response.clone()))) {
    clearCsrfToken();
    headers.set(CSRF_HEADER, await ensureCsrfToken(true));
    response = await fetch(url, {
      ...init,
      method,
      credentials: 'include',
      headers,
    });
  }

  return response;
}

export async function apiClient<T>(
  path: string,
  init?: ApiClientOptions,
  isRetry = false,
): Promise<T> {
  const tenantMatch = path.match(/^\/tenants\/([^/]+)/);
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (tenantMatch?.[1]) {
    headers.set('x-tenant-id', tenantMatch[1]);
  }

  const response = await fetchWithCsrf(`${API_V1_BASE}${path}`, {
    ...init,
    headers,
  }).catch((error: unknown) => {
    if (error instanceof ApiError) throw error;
    if (error instanceof TypeError) {
      throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
    }
    throw error;
  });

  if (!response.ok) {
    const payload = await parseErrorPayload(response);
    const message =
      (Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message) ??
      `Request failed (${response.status})`;

    if (response.status === 401 && !isRetry && shouldAttemptAuthRefresh(path)) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return apiClient<T>(path, init, true);
      }
      invalidateSession();
    }

    throw new ApiError(message, response.status, payload?.code);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) return undefined as T;

  return JSON.parse(text) as T;
}
