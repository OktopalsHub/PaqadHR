import { AxiosHeaders } from 'axios';

export function prepareApiRequestHeaders(
  headersInit?: HeadersInit,
  body?: BodyInit | null,
): AxiosHeaders {
  const headers = new AxiosHeaders();
  if (headersInit) {
    const normalizedHeaders = new Headers(headersInit);
    for (const [key, value] of normalizedHeaders.entries()) {
      headers.set(key, value);
    }
  }

  if (body && typeof body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return headers;
}
