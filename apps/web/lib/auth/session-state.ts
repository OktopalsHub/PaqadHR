import type { User } from '@/lib/schemas/auth';

/** Cached profile data must never unlock protected routes before revalidation. */
export function isServerValidatedSession(
  user: User | null | undefined,
  isPlaceholderData: boolean,
): boolean {
  return !isPlaceholderData && Boolean(user);
}

export function isSessionBootstrapLoading(
  sessionBootstrapEnabled: boolean,
  isPending: boolean,
  isPlaceholderData: boolean,
): boolean {
  return sessionBootstrapEnabled && (isPending || isPlaceholderData);
}

/** Distinguishes settled unauthenticated sessions from transient bootstrap failures. */
export function hasResolvedSessionBootstrap(
  sessionBootstrapEnabled: boolean,
  isFetched: boolean,
  isPlaceholderData: boolean,
  isError: boolean,
): boolean {
  return sessionBootstrapEnabled && isFetched && !isPlaceholderData && !isError;
}
