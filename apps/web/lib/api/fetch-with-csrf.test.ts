import assert from 'node:assert/strict';
import test from 'node:test';
import { executeFetchWithCsrf } from './fetch-with-csrf.ts';

const CSRF_HEADER = 'x-csrf-token';

test('adds a CSRF token header for unsafe methods', async () => {
  const tokenRequests: Array<boolean | undefined> = [];
  const calls: RequestInit[] = [];

  await executeFetchWithCsrf(
    'https://example.com/api/v1/notifications',
    { method: 'post' },
    {
      fetchImpl: async (_input, init) => {
        calls.push(init ?? {});
        return new Response(null, { status: 204 });
      },
      ensureCsrfToken: async (force) => {
        tokenRequests.push(force);
        return 'token-1';
      },
      clearCsrfToken: () => {},
      csrfHeader: CSRF_HEADER,
    },
  );

  assert.deepEqual(tokenRequests, [undefined]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].credentials, 'include');
  assert.equal(new Headers(calls[0].headers).get(CSRF_HEADER), 'token-1');
});

test('respects skipCsrf for unsafe methods', async () => {
  let tokenRequests = 0;
  const calls: RequestInit[] = [];

  await executeFetchWithCsrf(
    'https://example.com/api/v1/notifications',
    {
      method: 'DELETE',
      skipCsrf: true,
      headers: { 'x-request-id': 'req-1' },
    },
    {
      fetchImpl: async (_input, init) => {
        calls.push(init ?? {});
        return new Response(null, { status: 204 });
      },
      ensureCsrfToken: async () => {
        tokenRequests += 1;
        return 'token-should-not-be-used';
      },
      clearCsrfToken: () => {},
      csrfHeader: CSRF_HEADER,
    },
  );

  assert.equal(tokenRequests, 0);
  assert.equal(calls.length, 1);
  assert.equal(new Headers(calls[0].headers).get(CSRF_HEADER), null);
  assert.equal(new Headers(calls[0].headers).get('x-request-id'), 'req-1');
});

test('refreshes the CSRF token and retries after a CSRF-specific 403 response', async () => {
  const tokenRequests: Array<boolean | undefined> = [];
  const headerValues: Array<string | null> = [];
  let clearCalls = 0;

  await executeFetchWithCsrf(
    'https://example.com/api/v1/notifications',
    { method: 'PATCH' },
    {
      fetchImpl: async (_input, init) => {
        headerValues.push(new Headers(init?.headers).get(CSRF_HEADER));

        if (headerValues.length === 1) {
          return Response.json({ message: 'csrf token invalid' }, { status: 403 });
        }

        return new Response(null, { status: 204 });
      },
      ensureCsrfToken: async (force) => {
        tokenRequests.push(force);
        return force ? 'token-2' : 'token-1';
      },
      clearCsrfToken: () => {
        clearCalls += 1;
      },
      csrfHeader: CSRF_HEADER,
    },
  );

  assert.deepEqual(tokenRequests, [undefined, true]);
  assert.equal(clearCalls, 1);
  assert.deepEqual(headerValues, ['token-1', 'token-2']);
});

test('preserves method and headers from Request inputs before applying CSRF headers', async () => {
  const request = new Request('https://example.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'x-request-id': 'req-1',
      'content-type': 'application/json',
    },
    credentials: 'omit',
    body: JSON.stringify({ hello: 'world' }),
  });
  const tokenRequests: Array<boolean | undefined> = [];
  const calls: RequestInit[] = [];

  await executeFetchWithCsrf(request, undefined, {
    fetchImpl: async (_input, init) => {
      calls.push(init ?? {});
      return new Response(null, { status: 204 });
    },
    ensureCsrfToken: async (force) => {
      tokenRequests.push(force);
      return 'token-1';
    },
    clearCsrfToken: () => {},
    csrfHeader: CSRF_HEADER,
  });

  assert.deepEqual(tokenRequests, [undefined]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].credentials, 'omit');
  assert.equal(new Headers(calls[0].headers).get('x-request-id'), 'req-1');
  assert.equal(new Headers(calls[0].headers).get('content-type'), 'application/json');
  assert.equal(new Headers(calls[0].headers).get(CSRF_HEADER), 'token-1');
});

test('times out a fetch attempt that never settles', async () => {
  const originalSetTimeout = globalThis.setTimeout;
  let timeoutCallback: (() => void) | undefined;
  globalThis.setTimeout = ((callback: () => void) => {
    timeoutCallback = callback;
    return 1 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;

  try {
    const request = executeFetchWithCsrf('https://example.com/api/v1/notifications', undefined, {
      fetchImpl: async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
      ensureCsrfToken: async () => 'token-1',
      clearCsrfToken: () => {},
      csrfHeader: CSRF_HEADER,
    });

    timeoutCallback?.();
    await assert.rejects(request, /Request timed out/);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
});
