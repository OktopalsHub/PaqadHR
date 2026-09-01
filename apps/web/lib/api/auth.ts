import { invalidateSession, refreshAccessToken } from '@/lib/api/auth-refresh';
import { ApiError, apiClient, bootstrapCsrf, clearCsrfToken } from '@/lib/api/client';
import { fetchUserTenants } from '@/lib/api/tenants';
import { cacheKeys, MAX_CACHE_TTL, setCached } from '@/lib/cache';
import { isOnTenantSubdomain } from '@/lib/navigation/tenant-routes';
import type { LoginInput, SignupInput, User } from '@/lib/schemas/auth';
import { userSchema } from '@/lib/schemas/auth';
import {
  type SessionBootstrap,
  sessionBootstrapSchema,
} from '@/lib/schemas/session-bootstrap';
import type { Tenant } from '@/lib/schemas/tenant';
import { persistSession, persistTenantId, persistTenantSlug, readTenantId } from '@/lib/session';

type AuthResponse = {
  user: { id: string; email: string; role: string };
};

export type RegistrationResponse = {
  email: string;
  verificationRequired: true;
};

export type ProfileResponse = {
  id: string;
  email: string;
  role: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function mapSessionUser(bootstrap: SessionBootstrap): User {
  return userSchema.parse({
    id: bootstrap.user.id,
    email: bootstrap.user.email,
    name: '',
    role: bootstrap.user.role,
    needsOnboarding: bootstrap.workspaces.length === 0,
  });
}

export function applySessionBootstrap(bootstrap: SessionBootstrap): void {
  if (bootstrap.workspaces.length > 0) {
    setCached(cacheKeys.tenants.all, bootstrap.workspaces, { ttl: MAX_CACHE_TTL });
  }

  const storedTenantId = readTenantId();
  const storedTenant = storedTenantId
    ? bootstrap.workspaces.find((item) => item.id === storedTenantId)
    : null;
  const active =
    storedTenant ??
    bootstrap.workspaces.find((item) => item.isActive) ??
    bootstrap.workspaces[0];

  if (active) {
    persistTenantId(active.id);
    if (active.slug) persistTenantSlug(active.slug);
  }
}

async function fetchSessionBootstrap(): Promise<SessionBootstrap> {
  const data = await apiClient<unknown>('/auth/session');
  return sessionBootstrapSchema.parse(data);
}

/**
 * After OAuth redirect, auth cookies can take a moment to attach on cross-origin fetches.
 * Retry session bootstrap before treating the login as failed.
 */
export async function waitForSessionBootstrap(options?: {
  attempts?: number;
  baseDelayMs?: number;
}): Promise<SessionBootstrap | null> {
  const attempts = options?.attempts ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 100;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fetchSessionBootstrap();
    } catch (error) {
      const isLast = attempt === attempts - 1;
      if (error instanceof ApiError && error.status === 401 && !isLast) {
        await sleep(baseDelayMs * (attempt + 1));
        continue;
      }
      return null;
    }
  }
  return null;
}

/** @deprecated Use waitForSessionBootstrap */
export async function waitForAuthenticatedProfile(options?: {
  attempts?: number;
  baseDelayMs?: number;
}): Promise<ProfileResponse | null> {
  const bootstrap = await waitForSessionBootstrap(options);
  return bootstrap?.user ?? null;
}

export async function loadUserTenantsWithRetry(options?: {
  attempts?: number;
  baseDelayMs?: number;
}): Promise<Tenant[]> {
  const attempts = options?.attempts ?? 2;
  const baseDelayMs = options?.baseDelayMs ?? 100;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fetchUserTenants();
    } catch {
      if (attempt < attempts - 1) {
        await sleep(baseDelayMs * (attempt + 1));
      }
    }
  }
  return [];
}

export function persistUserSession(
  profile: ProfileResponse | SessionBootstrap['user'],
  needsOnboarding?: boolean,
): User {
  const user = userSchema.parse({
    id: profile.id,
    email: profile.email,
    name: '',
    role: profile.role,
    needsOnboarding,
  });
  persistSession();
  return user;
}

export async function refreshSession(): Promise<boolean> {
  return refreshAccessToken();
}

export { invalidateSession };

export async function getSession(): Promise<SessionBootstrap | null> {
  if (typeof window === 'undefined') return null;

  try {
    const bootstrap = await waitForSessionBootstrap({
      attempts: isOnTenantSubdomain() ? 4 : 2,
      baseDelayMs: isOnTenantSubdomain() ? 100 : 80,
    });
    if (!bootstrap) return null;

    applySessionBootstrap(bootstrap);
    persistSession();
    return bootstrap;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      invalidateSession();
      clearCsrfToken();
    }
    return null;
  }
}

export async function login(input: LoginInput): Promise<SessionBootstrap> {
  await apiClient<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      rememberMe: input.rememberMe,
    }),
    skipCsrf: true,
  });

  await bootstrapCsrf();
  const bootstrap = await waitForSessionBootstrap({ attempts: 3, baseDelayMs: 100 });
  if (!bootstrap) {
    throw new Error('Login succeeded, but we could not load your session. Please refresh.');
  }
  applySessionBootstrap(bootstrap);
  persistSession();
  return bootstrap;
}

export async function register(input: SignupInput): Promise<RegistrationResponse> {
  return apiClient<RegistrationResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      termsAccepted: input.agreeToTerms,
    }),
    skipCsrf: true,
  });
}

export async function resendEmailVerification(email: string): Promise<void> {
  await apiClient('/auth/register/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
    skipCsrf: true,
  });
}

export async function verifyEmail(email: string, code: string): Promise<SessionBootstrap> {
  await apiClient<AuthResponse>('/auth/register/verify-email', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
    skipCsrf: true,
  });

  await bootstrapCsrf();
  const bootstrap = await waitForSessionBootstrap({ attempts: 5, baseDelayMs: 150 });
  if (!bootstrap) {
    throw new Error('Email verified, but we could not start your session. Please sign in.');
  }
  applySessionBootstrap(bootstrap);
  persistSession();
  return bootstrap;
}

export async function logoutRequest(): Promise<void> {
  try {
    await apiClient('/auth/logout', { method: 'POST', skipCsrf: true });
  } catch (error) {
    console.error('Logout request failed:', error);
    throw error;
  } finally {
    clearCsrfToken();
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  if (!email) throw new Error('Email is required');

  await apiClient<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
    skipCsrf: true,
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  if (!token) throw new Error('Reset token is required');

  await apiClient<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
    skipCsrf: true,
  });
}

export function clearSession() {
  invalidateSession();
  clearCsrfToken();
}

export type OtpPurpose = 'password_change' | 'payment_method';

export async function fetchAuthSecurity(): Promise<{ canChangePassword: boolean }> {
  return apiClient('/auth/security');
}

export async function sendOtp(purpose: OtpPurpose): Promise<{ message: string }> {
  return apiClient('/auth/otp/send', {
    method: 'POST',
    body: JSON.stringify({ purpose }),
  });
}

export async function verifyOtp(purpose: OtpPurpose, code: string): Promise<{ otpProof: string }> {
  return apiClient('/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ purpose, code }),
  });
}

export async function changePassword(
  otpProof: string,
  newPassword: string,
): Promise<{ message: string }> {
  return apiClient('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ otpProof, newPassword }),
  });
}
