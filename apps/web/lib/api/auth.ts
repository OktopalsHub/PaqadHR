import { apiClient, clearCsrfToken } from "@/lib/api/client";
import {
  clearSessionStorage,
  persistSession,
  readSession,
} from "@/lib/session";
import type { LoginInput, SignupInput, User } from "@/lib/schemas/auth";
import { userSchema } from "@/lib/schemas/auth";

const ONBOARDING_KEY = "onboarding_completed";

type AuthResponse = {
  user: { id: string; email: string; role: string };
};

type ProfileResponse = {
  id: string;
  email: string;
  role: string;
};

function mapAuthUser(
  user: AuthResponse["user"] | ProfileResponse,
  needsOnboarding?: boolean,
): User {
  return userSchema.parse({
    id: user.id,
    email: user.email,
    name: user.email.split("@")[0],
    role: user.role,
    needsOnboarding,
  });
}

export async function getSession(): Promise<User | null> {
  if (typeof window === "undefined") return null;

  try {
    const profile = await apiClient<ProfileResponse>("/users/profile");
    if (!profile) return readSession();

    const user = mapAuthUser(profile, !localStorage.getItem(ONBOARDING_KEY));
    persistSession(user);
    return user;
  } catch {
    return readSession();
  }
}

export async function login(input: LoginInput): Promise<User> {
  const response = await apiClient<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      password: input.password,
    }),
    skipCsrf: true,
  });

  const user = mapAuthUser(
    response.user,
    !localStorage.getItem(ONBOARDING_KEY),
  );
  persistSession(user);
  return user;
}

export async function register(input: SignupInput): Promise<User> {
  const response = await apiClient<AuthResponse>("/auth/register", {
    method: "POST",
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
    await apiClient("/auth/logout", { method: "POST" });
  } catch {
    // Cookie may already be cleared
  } finally {
    clearCsrfToken();
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  if (!email) throw new Error("Email is required");
}

export function clearSession() {
  clearSessionStorage();
  clearCsrfToken();
}
