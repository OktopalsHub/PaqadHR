import type { User } from "@/lib/schemas/auth";
import { userSchema } from "@/lib/schemas/auth";

const SESSION_KEY = "paqad_session";
const TENANT_KEY = "paqad_tenant_id";
const ONBOARDING_KEY = "onboarding_completed";

export function persistSession(user: User) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function readSession(): User | null {
  if (typeof window === "undefined") return null;

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
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(TENANT_KEY);
  localStorage.removeItem(ONBOARDING_KEY);
}

export function persistTenantId(tenantId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TENANT_KEY, tenantId);
}

export function readTenantId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TENANT_KEY);
}

export function clearTenantId() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TENANT_KEY);
}

export function markOnboardingComplete() {
  if (typeof window === "undefined") return;
  localStorage.setItem(ONBOARDING_KEY, "true");
}

export function isOnboardingComplete(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ONBOARDING_KEY) === "true";
}
