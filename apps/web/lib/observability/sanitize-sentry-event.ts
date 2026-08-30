type SentryEventShape = {
  breadcrumbs?: unknown[];
  exception?: { values?: Array<{ value?: string }> };
  extra?: Record<string, unknown>;
  message?: string;
  request?: {
    cookies?: unknown;
    data?: unknown;
    headers?: Record<string, string | undefined>;
    url?: string;
  };
  user?: unknown;
};

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;

function redactText(value: string): string {
  return value
    .replace(EMAIL_PATTERN, '[redacted-email]')
    .replace(BEARER_TOKEN_PATTERN, 'Bearer [redacted-token]');
}

function withoutQueryString(url: string): string {
  try {
    return new URL(url, 'https://paqad.invalid').pathname;
  } catch {
    return url.split('?')[0] ?? url;
  }
}

/** Removes user-controlled and credential-bearing data before Sentry receives an event. */
export function sanitizeSentryEvent<T extends SentryEventShape>(event: T): T {
  delete event.user;
  delete event.extra;
  event.breadcrumbs = [];

  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.headers;
    if (event.request.url) event.request.url = withoutQueryString(event.request.url);
  }

  if (event.message) event.message = redactText(event.message);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = redactText(exception.value);
  }

  return event;
}
