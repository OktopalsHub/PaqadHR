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
const BASIC_AUTH_PATTERN = /\b(?:Authorization\s*:\s*)?Basic\s+[A-Za-z0-9+/]+={0,2}/gi;
const AUTHORIZATION_HEADER_PATTERN = /\bAuthorization\s*:\s*[^\r\n]+/gi;
const COOKIE_HEADER_PATTERN = /\b(?:Set-)?Cookie\s*:\s*[^\r\n]+/gi;
const SENSITIVE_ASSIGNMENT_PATTERN =
  /\b(password|passcode|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|session(?:[_-]?id)?|token)\b["']?\s*[:=]\s*["']?[^\s,;&}"']+/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const KNOWN_API_KEY_PATTERN = /\b(?:sk|pk|phc|phx|xox[baprs]|sg)_[A-Za-z0-9_-]{8,}\b/g;
const AWS_ACCESS_KEY_PATTERN = /\bAKIA[A-Z0-9]{16}\b/g;

function redactText(value: string): string {
  return value
    .replace(EMAIL_PATTERN, '[redacted-email]')
    .replace(BEARER_TOKEN_PATTERN, 'Bearer [redacted-token]')
    .replace(BASIC_AUTH_PATTERN, 'Authorization: Basic [redacted-token]')
    .replace(AUTHORIZATION_HEADER_PATTERN, 'Authorization: [redacted]')
    .replace(COOKIE_HEADER_PATTERN, 'Cookie: [redacted]')
    .replace(SENSITIVE_ASSIGNMENT_PATTERN, '$1=[redacted-secret]')
    .replace(JWT_PATTERN, '[redacted-token]')
    .replace(KNOWN_API_KEY_PATTERN, '[redacted-api-key]')
    .replace(AWS_ACCESS_KEY_PATTERN, '[redacted-api-key]');
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
