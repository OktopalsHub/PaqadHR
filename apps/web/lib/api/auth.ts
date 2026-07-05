import { invalidateSession, refreshAccessToken } from '@/lib/api/auth-refresh';
import {
  ApiError,
  apiClient,
  clearCsrfToken,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '@/lib/api/client';
import { fetchUserTenants } from '@/lib/api/tenants';
import type { LoginInput, SignupInput, User } from '@/lib/schemas/auth';
import { userSchema } from '@/lib/schemas/auth';
import { persistSession, persistTenantId, persistTenantSlug } from '@/lib/session';

type AuthResponse = {
  accessToken?: string;
  refreshToken?: string;
  user: { id: string; email: string; role: string };
};

function storeAuthTokens(response: AuthResponse) {
  if (response.accessToken) setAccessToken(response.accessToken);
  if (response.refreshToken) setRefreshToken(response.refreshToken);
}

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
  if (!getAccessToken() && !getRefreshToken()) return null;

  try {
    const profile = await fetchProfile();
    const needsOnboarding = await syncTenantFromApi();
    const user = mapAuthUser(profile, needsOnboarding);
    persistSession(user);
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
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

  storeAuthTokens(response);
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

  storeAuthTokens(response);
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
