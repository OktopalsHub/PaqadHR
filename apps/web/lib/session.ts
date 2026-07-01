import type { User } from '@/lib/schemas/auth';
import { userSchema } from '@/lib/schemas/auth';

const SESSION_KEY = 'paqad_session';
const TENANT_KEY = 'paqad_tenant_id';
const TENANT_SLUG_KEY = 'paqad_tenant_slug';
const AUTH_MARKER_KEY = 'paqad_auth';
const AUTH_MARKER_MAX_AGE = 7 * 24 * 60 * 60;

function writeAuthMarker(active: boolean) {
  if (typeof window === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = active
    ? `${AUTH_MARKER_KEY}=1; path=/; max-age=${AUTH_MARKER_MAX_AGE}; SameSite=Lax${secure}`
    : `${AUTH_MARKER_KEY}=; path=/; max-age=0; SameSite=Lax${secure}`;
}

export function persistSession(user: User) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  writeAuthMarker(true);
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
  document.cookie = 'tenant_slug=; path=/; max-age=0; SameSite=Lax';
  writeAuthMarker(false);
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
  document.cookie = 'tenant_slug=; path=/; max-age=0; SameSite=Lax';
}
