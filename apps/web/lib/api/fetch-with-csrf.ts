export type FetchWithCsrfOptions = RequestInit & {
  skipCsrf?: boolean;
};

export type FetchWithCsrfDeps = {
  fetchImpl: typeof fetch;
  ensureCsrfToken: (force?: boolean) => Promise<string>;
  clearCsrfToken: () => void;
  csrfHeader: string;
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

  let response = await deps.fetchImpl(input, {
    ...init,
    method,
    headers,
    credentials: init?.credentials ?? requestDefaults.credentials ?? 'include',
  });

  const payload = await parseResponsePayload(response.clone());
  if (needsCsrf && isCsrfErrorResponse(response.status, payload)) {
    deps.clearCsrfToken();
    headers.set(deps.csrfHeader, await deps.ensureCsrfToken(true));
    response = await deps.fetchImpl(input, {
      ...init,
      method,
      headers,
      credentials: init?.credentials ?? requestDefaults.credentials ?? 'include',
    });
  }

  return response;
}
