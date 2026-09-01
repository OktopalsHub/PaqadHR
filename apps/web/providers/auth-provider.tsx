'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { toast } from 'sonner';
import { ToastMessage } from '@/components/toast-message';
import { PrivacyConsentGate } from '@/features/auth/components/privacy-consent-gate';
import {
  clearSession,
  getSession,
  loadUserTenantsWithRetry,
  login as loginRequest,
  logoutRequest,
  persistUserSession,
  type RegistrationResponse,
  register as registerRequest,
  verifyEmail as verifyEmailRequest,
  waitForAuthenticatedProfile,
} from '@/lib/api/auth';
import {
  setRefreshCallbacks,
  startProactiveRefresh,
  stopProactiveRefresh,
} from '@/lib/api/auth-refresh';
import { bootstrapCsrf } from '@/lib/api/client';
import { isServerValidatedSession, isSessionBootstrapLoading } from '@/lib/auth/session-state';
import { cacheKeys, clearAppCache, getCached, setCached } from '@/lib/cache';
import { skipsSessionBootstrap } from '@/lib/navigation/public-routes';
import { goToHref, resolvePostAuthHref } from '@/lib/navigation/resolve-post-auth-href';
import { authPageUrl } from '@/lib/navigation/tenant-routes';
import { queryKeys } from '@/lib/query/keys';
import type { LoginInput, SignupInput, User } from '@/lib/schemas/auth';

interface AuthContextType {
  user: User | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: SignupInput) => Promise<RegistrationResponse>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

function readRedirectParam(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('redirect');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [hasHydrated, setHasHydrated] = useState(false);
  // Read the browser path for the first client render. During hydration,
  // Next's pathname state can briefly lag behind the URL; starting the session
  // query in that window sends an unnecessary profile request on auth pages.
  const currentPathname = typeof window === 'undefined' ? pathname : window.location.pathname;
  const sessionBootstrapEnabled = !skipsSessionBootstrap(currentPathname);

  // sessionStorage is not available on the server. Read it only after the
  // initial client render so protected UI has identical server/client HTML.
  useEffect(() => {
    setHasHydrated(true);
  }, []);

  // Apply the cached session immediately after hydration while the server
  // session check continues in the background.
  const cachedSession = useMemo(() => {
    if (!hasHydrated || !sessionBootstrapEnabled) return null;
    return getCached<User>(cacheKeys.auth.session);
  }, [hasHydrated, sessionBootstrapEnabled]);

  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: async () => {
      const user = await getSession();
      // Cache the session for instant subsequent loads
      if (user) {
        setCached(cacheKeys.auth.session, user, { ttl: 30 * 60 * 1000 }); // 30 minutes
      }
      return user;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — revalidate periodically so expired sessions are caught
    refetchOnWindowFocus: true,
    retry: 1,
    enabled: sessionBootstrapEnabled,
    // placeholderData shows cached session during loading but does NOT mark query as fresh
    // This prevents stale authenticated UI while the server session is validated
    placeholderData: cachedSession ?? undefined,
  });

  // Start proactive token refresh when user is authenticated
  useEffect(() => {
    setRefreshCallbacks({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      },
    });
    return () => {
      setRefreshCallbacks({});
    };
  }, [queryClient]);

  useEffect(() => {
    if (sessionQuery.data) {
      startProactiveRefresh();
    }
    return () => {
      stopProactiveRefresh();
    };
  }, [sessionQuery.data]);

  const navigateAfterAuth = useCallback(async () => {
    await waitForAuthenticatedProfile({ attempts: 3, baseDelayMs: 100 });

    await queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all });

    const tenants = await loadUserTenantsWithRetry({ attempts: 2, baseDelayMs: 100 });
    queryClient.setQueryData(queryKeys.tenants.all, tenants);

    const redirect = readRedirectParam();
    const href = await resolvePostAuthHref({ tenants, redirect });
    goToHref(href, router.push);
  }, [queryClient, router]);

  const loginMutation = useMutation({
    mutationFn: loginRequest,
    onSuccess: async (user) => {
      queryClient.setQueryData(queryKeys.auth.session, user);
      await bootstrapCsrf();
      toast.success(<ToastMessage title="Login Successful" description="Welcome back!" />);
      await navigateAfterAuth();
    },
    onError: (error: Error) => {
      toast.error(<ToastMessage title="Login Failed" description={error.message} />);
    },
  });

  const registerMutation = useMutation({
    mutationFn: registerRequest,
    onSuccess: () => {
      toast.success(
        <ToastMessage
          title="Check your email"
          description="Enter the verification code to activate your account."
        />,
      );
    },
    onError: (error: Error) => {
      toast.error(<ToastMessage title="Registration Failed" description={error.message} />);
    },
  });

  const verifyEmail = useCallback(
    async (email: string, code: string) => {
      await verifyEmailRequest(email, code);
      await bootstrapCsrf();

      const profile = await waitForAuthenticatedProfile({ attempts: 5, baseDelayMs: 150 });
      if (!profile) {
        throw new Error('Email verified, but we could not start your session. Please sign in.');
      }

      const tenants = await loadUserTenantsWithRetry({ attempts: 2, baseDelayMs: 100 });
      const user = persistUserSession(profile, tenants.length === 0);
      setCached(cacheKeys.auth.session, user, { ttl: 30 * 60 * 1000 });
      queryClient.setQueryData(queryKeys.auth.session, user);
      queryClient.setQueryData(queryKeys.tenants.all, tenants);

      const redirect = readRedirectParam();
      const href = await resolvePostAuthHref({ tenants, redirect });
      goToHref(href, router.replace);
    },
    [queryClient, router],
  );

  const logout = useCallback(async () => {
    stopProactiveRefresh();
    try {
      await logoutRequest();
    } catch {
      // Server unreachable — still tear down client state below
    }
    clearSession();
    queryClient.setQueryData(queryKeys.auth.session, null);
    queryClient.removeQueries({ queryKey: queryKeys.tenants.all });
    queryClient.removeQueries({ queryKey: ['privacy', 'consent'] });
    clearAppCache();
    toast(<ToastMessage title="Logout Successful" description="You have been logged out" />);
    window.location.assign(authPageUrl('/signin'));
  }, [queryClient]); // window.location.assign intentional: full state teardown on logout

  const value = useMemo<AuthContextType>(
    () => ({
      user: sessionQuery.data ?? null,
      login: async (input) => {
        await loginMutation.mutateAsync(input);
      },
      register: async (input) => {
        return registerMutation.mutateAsync(input);
      },
      verifyEmail,
      logout,
      // Placeholder data is only a visual cache. A session is authenticated
      // only after React Query has replaced it with the server's response.
      isAuthenticated: isServerValidatedSession(sessionQuery.data, sessionQuery.isPlaceholderData),
      isLoading:
        isSessionBootstrapLoading(
          sessionBootstrapEnabled,
          sessionQuery.isPending,
          sessionQuery.isPlaceholderData,
        ) ||
        loginMutation.isPending ||
        registerMutation.isPending,
    }),
    [
      sessionBootstrapEnabled,
      sessionQuery.data,
      sessionQuery.isPending,
      sessionQuery.isPlaceholderData,
      loginMutation,
      registerMutation,
      verifyEmail,
      logout,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <PrivacyConsentGate />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
