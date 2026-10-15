import { AxiosHeaders } from 'axios';
import { getCorrelationId, getCorrelationIdHeaderName } from '@/lib/observability/correlation-id';

export function prepareApiRequestHeaders(headersInit?: HeadersInit, body?: unknown): AxiosHeaders {
  const headers = new AxiosHeaders();
  if (headersInit) {
    const normalizedHeaders = new Headers(headersInit);
    for (const [key, value] of normalizedHeaders.entries()) {
      headers.set(key, value);
    }
  }

  headers.set(getCorrelationIdHeaderName(), getCorrelationId());

  if (body && typeof body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return headers;
}
