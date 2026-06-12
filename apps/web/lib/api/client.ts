const API_V1_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

const API_ROOT = API_V1_BASE.replace(/\/api\/v1\/?$/, "/api");

let csrfToken: string | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getApiV1Base() {
  return API_V1_BASE;
}

export function tenantPath(tenantId: string, path = "") {
  const suffix = path.startsWith("/") ? path : path ? `/${path}` : "";
  return `/tenants/${tenantId}${suffix}`;
}

export async function ensureCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;

  const response = await fetch(`${API_ROOT}/csrf/token`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new ApiError("Failed to fetch CSRF token", response.status);
  }

  const data = (await response.json()) as { csrfToken: string };
  csrfToken = data.csrfToken;
  return csrfToken;
}

export function clearCsrfToken() {
  csrfToken = null;
}

type ApiClientOptions = RequestInit & {
  skipCsrf?: boolean;
};

export async function apiClient<T>(
  path: string,
  init?: ApiClientOptions,
): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const needsCsrf =
    !init?.skipCsrf &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }

  if (needsCsrf) {
    headers.set("x-csrf-token", await ensureCsrfToken());
  }

  const response = await fetch(`${API_V1_BASE}${path}`, {
    ...init,
    method,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      (Array.isArray(payload?.message)
        ? payload.message.join(", ")
        : payload?.message) ?? `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) return undefined as T;

  return JSON.parse(text) as T;
}
