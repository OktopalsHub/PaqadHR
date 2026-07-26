import axios, { type AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { refreshAccessToken, startProactiveRefresh } from '@/lib/api/auth-refresh';
import { normalizeApiV1Base, resolveApiBaseUrl } from '@/lib/api-origin';

const CSRF_HEADER = 'x-csrf-token';

let csrfToken: string | null = null;
let csrfTokenPromise: Promise<string> | null = null;

const LEGACY_ACCESS_TOKEN_KEY = 'paqad_access_token';
const LEGACY_REFRESH_TOKEN_KEY = 'paqad_refresh_token';

function resolveApiV1Base(): string {
  return normalizeApiV1Base(
    resolveApiBaseUrl(
      typeof window !== 'undefined' ? { requestHost: window.location.hostname } : undefined,
    ),
  );
}

export function clearLegacyAuthTokens(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
}

/** @deprecated Auth uses httpOnly cookies; kept for call-site compatibility. */
export function setAccessToken(_token: string | null) {
  clearLegacyAuthTokens();
}

/** @deprecated Auth uses httpOnly cookies. */
export function getAccessToken(): string | null {
  return null;
}

/** @deprecated Auth uses httpOnly cookies; kept for call-site compatibility. */
export function setRefreshToken(_token: string | null) {
  clearLegacyAuthTokens();
}

/** @deprecated Auth uses httpOnly cookies. */
export function getRefreshToken(): string | null {
  return null;
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

export function getApiV1Base(): string {
  return resolveApiV1Base();
}

export function getApiOrigin(): string {
  return getApiV1Base().replace(/\/api\/v1$/, '');
}

export function tenantPath(tenantId: string, path = ''): string {
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
    const response = await axios.get<{ csrfToken: string }>(`${getApiOrigin()}/csrf/token`, {
      withCredentials: true,
    });

    const data = response.data;
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
  clearLegacyAuthTokens();
  try {
    await ensureCsrfToken(true);
  } catch {}
  startProactiveRefresh();
}

export function clearCsrfToken() {
  csrfToken = null;
  csrfTokenPromise = null;
}

type ApiClientOptions = {
  skipCsrf?: boolean;
  [key: string]: unknown;
};

const AUTH_PATHS_WITHOUT_REFRESH = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
];

const REFRESH_RETRY_DELAYS_MS = [1000, 2000];

function shouldAttemptAuthRefresh(path: string): boolean {
  return !AUTH_PATHS_WITHOUT_REFRESH.some((prefix) => path.startsWith(prefix));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseErrorPayload(response: AxiosResponse): Promise<unknown> {
  try {
    return response.data;
  } catch {
    return null;
  }
}

const http = axios.create({
  baseURL: resolveApiV1Base(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

http.interceptors.request.use(async (config) => {
  const method = (config.method ?? 'get').toUpperCase();
  const needsCsrf = !(config as AxiosRequestConfig & { skipCsrf?: boolean }).skipCsrf && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  if (needsCsrf) {
    config.headers[CSRF_HEADER] = await ensureCsrfToken();
  }

  const path = config.url ?? '';
  const tenantMatch = path.match(/^\/tenants\/([^/]+)/);
  if (tenantMatch?.[1]) {
    config.headers['x-tenant-id'] = tenantMatch[1];
  }

  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config;
    if (!config) return Promise.reject(error);

    const path = config.url ?? '';
    const status = error.response?.status ?? 0;

    const isRetry = (config as AxiosRequestConfig & { _isRetry?: boolean })._isRetry ?? false;

    if (status === 401 && !isRetry && shouldAttemptAuthRefresh(path)) {
      (config as AxiosRequestConfig & { _isRetry?: boolean })._isRetry = true;

      for (let attempt = 0; attempt < REFRESH_RETRY_DELAYS_MS.length; attempt++) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          startProactiveRefresh();
          return http(config as AxiosRequestConfig);
        }
        await sleep(REFRESH_RETRY_DELAYS_MS[attempt]);
      }
    }

    const payload = await parseErrorPayload(error.response as AxiosResponse);
    const message =
      (Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message) ??
      `Request failed (${status})`;

    throw new ApiError(message, status, payload?.code);
  },
);

export async function apiClient<T>(
  path: string,
  init?: ApiClientOptions,
  isRetry = false,
): Promise<T> {
  const config: AxiosRequestConfig = {
    url: path,
    method: (init?.method as string) ?? 'GET',
    data: init?.body,
    skipCsrf: init?.skipCsrf,
    _isRetry: isRetry,
  };

  if (init?.headers) {
    const headers = init.headers as Record<string, string>;
    for (const [key, value] of Object.entries(headers)) {
      config.headers[key] = value;
    }
  }

  if (init?.body && typeof init.body === 'string' && !config.headers['Content-Type']) {
    config.headers['Content-Type'] = 'application/json';
  }

  const response = await http(config).catch((err: unknown) => {
    if (err instanceof ApiError) throw err;
    if (err instanceof TypeError) {
      throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
    }
    throw err;
  });

  if (response.status === 204) {
    return undefined as T;
  }

  return response.data as T;
}