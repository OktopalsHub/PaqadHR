import { invalidateSession, refreshAccessToken } from '@/lib/api/auth-refresh';
import { ApiError, apiClient, clearCsrfToken } from '@/lib/api/client';
import { fetchUserTenants } from '@/lib/api/tenants';
import type { LoginInput, SignupInput, User } from '@/lib/schemas/auth';
import { userSchema } from '@/lib/schemas/auth';
import { persistSession, persistTenantId, persistTenantSlug } from '@/lib/session';

type AuthResponse = {
  user: { id: string; email: string; role: string };
};

type ProfileResponse = {
  id: string;
  email: string;
  role: string;
};

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

export async function refreshSession(): Promise<boolean> {
  return refreshAccessToken();
}

export { invalidateSession };

export async function getSession(): Promise<User | null> {
  if (typeof window === 'undefined') return null;

  try {
    const profile = await fetchProfile();
    const needsOnboarding = await syncTenantFromApi();
    const user = mapAuthUser(profile, needsOnboarding);
    persistSession(user);
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        try {
          const profile = await fetchProfile();
          const needsOnboarding = await syncTenantFromApi();
          const user = mapAuthUser(profile, needsOnboarding);
          persistSession(user);
          return user;
        } catch {
          invalidateSession();
          return null;
        }
      }
      invalidateSession();
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

  const needsOnboarding = await syncTenantFromApi();
  const user = mapAuthUser(response.user, needsOnboarding);
  persistSession(user);
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

  const user = mapAuthUser(response.user, true);
  persistSession(user);
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

export function clearSession() {
  invalidateSession();
}
