import { getCorrelationId, getCorrelationIdHeaderName } from '@/lib/observability/correlation-id';
import { API_REQUEST_TIMEOUT_MS } from './request-timeout';

export type FetchWithCsrfOptions = RequestInit & {
  skipCsrf?: boolean;
};

export type FetchWithCsrfDeps = {
  fetchImpl: typeof fetch;
  ensureCsrfToken: (force?: boolean) => Promise<string>;
  clearCsrfToken: () => void;
  csrfHeader: string;
  requestTimeoutMs?: number;
};

const UNSAFE_HTTP_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isCsrfErrorResponse(status: number, payload: unknown): boolean {
  if (status !== 403) return false;
  if (!payload || typeof payload !== 'object') return false;
  const message = String((payload as { message?: string }).message ?? '').toLowerCase();
  return message.includes('csrf');
}

export function shouldAttachCsrfToken(method: string, skipCsrf?: boolean): boolean {
  return !skipCsrf && UNSAFE_HTTP_METHODS.has(method.toUpperCase());
}

async function parseResponsePayload(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function getRequestDefaults(input: RequestInfo | URL): {
  method?: string;
  headers?: Headers;
  credentials?: RequestCredentials;
} {
  if (!(input instanceof Request)) {
    return {};
  }

  return {
    method: input.method,
    headers: new Headers(input.headers),
    credentials: input.credentials,
  };
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  deps: FetchWithCsrfDeps,
): Promise<Response> {
  const controller = new AbortController();
  const callerSignal = init.signal;
  let timedOut = false;
  const onCallerAbort = () => controller.abort(callerSignal?.reason);

  if (callerSignal?.aborted) {
    onCallerAbort();
  } else {
    callerSignal?.addEventListener('abort', onCallerAbort, { once: true });
  }

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, deps.requestTimeoutMs ?? API_REQUEST_TIMEOUT_MS);

  try {
    return await deps.fetchImpl(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      throw new Error('Request timed out. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener('abort', onCallerAbort);
  }
}

export async function executeFetchWithCsrf(
  input: RequestInfo | URL,
  init: FetchWithCsrfOptions | undefined,
  deps: FetchWithCsrfDeps,
): Promise<Response> {
  const requestDefaults = getRequestDefaults(input);
  const method = (init?.method ?? requestDefaults.method ?? 'GET').toUpperCase();
  const needsCsrf = shouldAttachCsrfToken(method, init?.skipCsrf);
  const headers = new Headers(requestDefaults.headers);

  if (init?.headers) {
    for (const [key, value] of new Headers(init.headers).entries()) {
      headers.set(key, value);
    }
  }

  if (needsCsrf) {
    headers.set(deps.csrfHeader, await deps.ensureCsrfToken());
  }

  headers.set(getCorrelationIdHeaderName(), getCorrelationId());

  let response = await fetchWithTimeout(
    input,
    {
      ...init,
      method,
      headers,
      credentials: init?.credentials ?? requestDefaults.credentials ?? 'include',
    },
    deps,
  );

  if (needsCsrf) {
    const payload = await parseResponsePayload(response.clone());
    if (isCsrfErrorResponse(response.status, payload)) {
      deps.clearCsrfToken();
      headers.set(deps.csrfHeader, await deps.ensureCsrfToken(true));
      response = await fetchWithTimeout(
        input,
        {
          ...init,
          method,
          headers,
          credentials: init?.credentials ?? requestDefaults.credentials ?? 'include',
        },
        deps,
      );
    }
  }

  return response;
}
