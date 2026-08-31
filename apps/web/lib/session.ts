import { getAppDomain } from '@/lib/navigation/tenant-routes';

const LEGACY_SESSION_KEY = 'paqad_session';
const TENANT_KEY = 'paqad_tenant_id';
const TENANT_SLUG_KEY = 'paqad_tenant_slug';

function sharedCookieDomain(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const hostname = window.location.hostname;
  const appDomain = getAppDomain();
  if (hostname === appDomain || hostname.endsWith(`.${appDomain}`)) {
    return `.${appDomain}`;
  }
  return undefined;
}

function writeTenantSlugCookie(slug: string, maxAge: number) {
  const domain = sharedCookieDomain();
  const domainPart = domain ? `; Domain=${domain}` : '';
  // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API is not widely supported yet
  document.cookie = `tenant_slug=${encodeURIComponent(slug)}; path=/${domainPart}; max-age=${maxAge}; SameSite=Lax`;
}

function clearTenantSlugCookie() {
  const domain = sharedCookieDomain();
  const domainPart = domain ? `; Domain=${domain}` : '';
  // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API is not widely supported yet
  document.cookie = `tenant_slug=; path=/${domainPart}; max-age=0; SameSite=Lax`;
}

function writeTenantIdCookie(tenantId: string, maxAge: number) {
  const domain = sharedCookieDomain();
  const domainPart = domain ? `; Domain=${domain}` : '';
  // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API is not widely supported yet
  document.cookie = `tenant_id=${encodeURIComponent(tenantId)}; path=/${domainPart}; max-age=${maxAge}; SameSite=Lax`;
}

function clearTenantIdCookie() {
  const domain = sharedCookieDomain();
  const domainPart = domain ? `; Domain=${domain}` : '';
  // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API is not widely supported yet
  document.cookie = `tenant_id=; path=/${domainPart}; max-age=0; SameSite=Lax`;
}

/** User profile is loaded from the API only — never cached in localStorage (GDPR/NDPR). */
export function persistSession(): void {
  // Intentionally no-op: auth state lives in httpOnly cookies + server profile fetch.
}

export function readSession(): null {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LEGACY_SESSION_KEY);
  }
  return null;
}

export function clearSessionStorage() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LEGACY_SESSION_KEY);
  localStorage.removeItem(TENANT_KEY);
  localStorage.removeItem(TENANT_SLUG_KEY);
  clearTenantSlugCookie();
  clearTenantIdCookie();
}

export function persistTenantId(tenantId: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TENANT_KEY, tenantId);
  writeTenantIdCookie(tenantId, 31536000);
}

export function readTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TENANT_KEY);
}

export function persistTenantSlug(slug: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TENANT_SLUG_KEY, slug);
  writeTenantSlugCookie(slug, 31536000);
}

export function readTenantSlug(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TENANT_SLUG_KEY);
}

export function clearTenantId() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TENANT_KEY);
  localStorage.removeItem(TENANT_SLUG_KEY);
  clearTenantSlugCookie();
  clearTenantIdCookie();
}
