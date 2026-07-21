import { invalidateSession, refreshAccessToken } from '@/lib/api/auth-refresh';
import { ApiError, apiClient, bootstrapCsrf, clearCsrfToken } from '@/lib/api/client';
import { fetchUserTenants } from '@/lib/api/tenants';
import { isOnTenantSubdomain } from '@/lib/navigation/tenant-routes';
import type { LoginInput, SignupInput, User } from '@/lib/schemas/auth';
import { userSchema } from '@/lib/schemas/auth';
import type { Tenant } from '@/lib/schemas/tenant';
import { persistSession, persistTenantId, persistTenantSlug } from '@/lib/session';

type AuthResponse = {
  user: { id: string; email: string; role: string };
};

export type ProfileResponse = {
  id: string;
  email: string;
  role: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapAuthUser(
  user: AuthResponse['user'] | ProfileResponse,
  needsOnboarding?: boolean,
): User {
  return userSchema.parse({
    id: user.id,
    email: user.email,
    name: user.email.split('@')[0],
    role: user.role,
    needsOnboarding,
  });
}

async function syncTenantFromApi(): Promise<boolean> {
  const tenants = await fetchUserTenants();
  if (tenants.length === 0) return true;

  const active = tenants.find((item) => item.isActive) ?? tenants[0];
  persistTenantId(active.id);
  if (active.slug) persistTenantSlug(active.slug);
  return false;
}

async function fetchProfile(): Promise<ProfileResponse> {
  return apiClient<ProfileResponse>('/users/profile');
}

/**
 * After OAuth redirect, auth cookies can take a moment to attach on cross-origin fetches.
 * Retry profile before treating the login as failed.
 */
export async function waitForAuthenticatedProfile(options?: {
  attempts?: number;
  baseDelayMs?: number;
}): Promise<ProfileResponse | null> {
  const attempts = options?.attempts ?? 6;
  const baseDelayMs = options?.baseDelayMs ?? 150;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fetchProfile();
    } catch (error) {
      const isLast = attempt === attempts - 1;
      if (error instanceof ApiError && error.status === 401) {
        if (!isLast) {
          await sleep(baseDelayMs * (attempt + 1));
          continue;
        }
        invalidateSession();
        clearCsrfToken();
      }
      return null;
    }
  }
  return null;
}

export async function loadUserTenantsWithRetry(options?: {
  attempts?: number;
  baseDelayMs?: number;
}): Promise<Tenant[]> {
  const attempts = options?.attempts ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 150;

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

export function persistUserSession(profile: ProfileResponse, needsOnboarding?: boolean): User {
  const user = mapAuthUser(profile, needsOnboarding);
  persistSession();
  return user;
}

export async function refreshSession(): Promise<boolean> {
  return refreshAccessToken();
}

export { invalidateSession };

export async function getSession(): Promise<User | null> {
  if (typeof window === 'undefined') return null;

  try {
    const profile = isOnTenantSubdomain()
      ? await waitForAuthenticatedProfile({ attempts: 8, baseDelayMs: 175 })
      : await fetchProfile();
    if (!profile) return null;

    let needsOnboarding = true;
    try {
      needsOnboarding = await syncTenantFromApi();
    } catch {
      // Profile is authoritative for session; tenant list can load later.
    }
    const user = mapAuthUser(profile, needsOnboarding);
    persistSession();
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      invalidateSession();
      clearCsrfToken();
    }
    return null;
  }
}

export async function login(input: LoginInput): Promise<User> {
  const response = await apiClient<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      password: input.password,
    }),
    skipCsrf: true,
  });

  await bootstrapCsrf();
  const needsOnboarding = await syncTenantFromApi();
  const user = mapAuthUser(response.user, needsOnboarding);
  persistSession();
  return user;
}

export async function register(input: SignupInput): Promise<User> {
  const response = await apiClient<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      password: input.password,
    }),
    skipCsrf: true,
  });

  await bootstrapCsrf();
  const user = mapAuthUser(response.user, true);
  persistSession();
  return user;
}

export async function logoutRequest(): Promise<void> {
  try {
    await apiClient('/auth/logout', { method: 'POST' });
  } catch {
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
