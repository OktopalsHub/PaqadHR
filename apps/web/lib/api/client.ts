import axios, {
  type AxiosError,
  AxiosHeaders,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { refreshAccessToken, startProactiveRefresh } from '@/lib/api/auth-refresh';
import { normalizeApiV1Base, resolveApiBaseUrl } from '@/lib/api-origin';
import { prepareApiRequestHeaders } from './api-request-headers';
import { resolveApiErrorMessage } from './client-error-message';
import {
  executeFetchWithCsrf,
  type FetchWithCsrfOptions,
  isCsrfErrorResponse,
} from './fetch-with-csrf';

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

export async function ensureCsrfToken(force = false): Promise<string> {
  if (!force && csrfToken) return csrfToken;
  if (!force && csrfTokenPromise) return csrfTokenPromise;

  csrfTokenPromise = (async () => {
    try {
      const { data } = await axios.get<{ csrfToken: string }>(`${getApiOrigin()}/csrf/token`, {
        withCredentials: true,
      });
      if (!data.csrfToken) {
        throw new ApiError('CSRF token missing in response', 200);
      }
      csrfToken = data.csrfToken;
      return csrfToken;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const status = (error as AxiosError)?.response?.status ?? 0;
      throw new ApiError('Failed to fetch CSRF token', status);
    }
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

type ErrorPayload = {
  message?: string | string[];
  code?: string;
} | null;

type ApiRequestConfig = AxiosRequestConfig & {
  skipCsrf?: boolean;
  _isRetry?: boolean;
};

type ApiInterceptorConfig = InternalAxiosRequestConfig & {
  skipCsrf?: boolean;
  _isRetry?: boolean;
};

export type ApiClientOptions = Omit<AxiosRequestConfig, 'method' | 'headers' | 'data'> & {
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
  data?: unknown;
  skipCsrf?: boolean;
};

const AUTH_PATHS_WITHOUT_REFRESH = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
];

const REFRESH_RETRY_DELAYS_MS = [500, 1000];

function shouldAttemptAuthRefresh(path: string): boolean {
  return !AUTH_PATHS_WITHOUT_REFRESH.some((prefix) => path.startsWith(prefix));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseAxiosErrorPayload(response: AxiosResponse): Promise<ErrorPayload> {
  try {
    return response.data as ErrorPayload;
  } catch {
    return null;
  }
}

const http = axios.create({
  baseURL: resolveApiV1Base(),
  withCredentials: true,
});

http.interceptors.request.use(async (config) => {
  const requestConfig = config as ApiInterceptorConfig;
  const headers = AxiosHeaders.from(requestConfig.headers ?? {});
  const method = (requestConfig.method ?? 'get').toUpperCase();
  const needsCsrf = !requestConfig.skipCsrf && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  if (needsCsrf) {
    headers.set(CSRF_HEADER, await ensureCsrfToken());
  }

  const path = requestConfig.url ?? '';
  const tenantMatch = path.match(/^\/tenants\/([^/]+)/);
  if (tenantMatch?.[1]) {
    headers.set('x-tenant-id', tenantMatch[1]);
  }

  requestConfig.headers = headers;
  return requestConfig;
});

http.interceptors.response.use(
  (response) => {
    if (isCsrfErrorResponse(response.status, response.data)) {
      clearCsrfToken();
    }
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config;
    if (!config) return Promise.reject(error);
    const requestConfig = config as ApiRequestConfig;

    const path = requestConfig.url ?? '';
    const status = error.response?.status ?? 0;
    const isRetry = requestConfig._isRetry ?? false;

    if (status === 401 && !isRetry && shouldAttemptAuthRefresh(path)) {
      requestConfig._isRetry = true;

      for (let attempt = 0; attempt < REFRESH_RETRY_DELAYS_MS.length; attempt++) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          startProactiveRefresh();
          return http(requestConfig);
        }
        await sleep(REFRESH_RETRY_DELAYS_MS[attempt]);
      }
    }

    const payload = error.response ? await parseAxiosErrorPayload(error.response) : null;
    const message = resolveApiErrorMessage(status, payload);

    throw new ApiError(message, status, payload?.code);
  },
);

export async function fetchWithCsrf(
  input: RequestInfo | URL,
  init?: FetchWithCsrfOptions,
): Promise<Response> {
  return executeFetchWithCsrf(input, init, {
    fetchImpl: fetch,
    ensureCsrfToken,
    clearCsrfToken,
    csrfHeader: CSRF_HEADER,
  });
}

export async function apiClient<T>(
  path: string,
  init?: ApiClientOptions,
  isRetry = false,
): Promise<T> {
  const headers = prepareApiRequestHeaders(init?.headers, init?.body);

  const config: ApiRequestConfig = {
    url: path,
    method: init?.method ?? 'GET',
    data: init?.body ?? init?.data,
    params: init?.params,
    _isRetry: isRetry,
    skipCsrf: init?.skipCsrf,
    headers,
  };

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
