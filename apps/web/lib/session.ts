import type { User } from '@/lib/schemas/auth';
import { userSchema } from '@/lib/schemas/auth';

const SESSION_KEY = 'paqad_session';
const TENANT_KEY = 'paqad_tenant_id';
const TENANT_SLUG_KEY = 'paqad_tenant_slug';

export function persistSession(user: User) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function readSession(): User | null {
  if (typeof window === 'undefined') return null;

  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    return userSchema.parse(JSON.parse(raw));
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function clearSessionStorage() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(TENANT_KEY);
  localStorage.removeItem(TENANT_SLUG_KEY);
  // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API is not widely supported yet
  document.cookie = 'tenant_slug=; path=/; max-age=0; SameSite=Lax';
}

export function persistTenantId(tenantId: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TENANT_KEY, tenantId);
}

export function readTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TENANT_KEY);
}

export function persistTenantSlug(slug: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TENANT_SLUG_KEY, slug);
  // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API is not widely supported yet
  document.cookie = `tenant_slug=${encodeURIComponent(slug)}; path=/; max-age=31536000; SameSite=Lax`;
}

export function readTenantSlug(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TENANT_SLUG_KEY);
}

export function clearTenantId() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TENANT_KEY);
  localStorage.removeItem(TENANT_SLUG_KEY);
  // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API is not widely supported yet
  document.cookie = 'tenant_slug=; path=/; max-age=0; SameSite=Lax';
}
