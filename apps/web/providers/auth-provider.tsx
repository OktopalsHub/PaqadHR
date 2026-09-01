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
  login as loginRequest,
  logoutRequest,
  mapSessionUser,
  type RegistrationResponse,
  register as registerRequest,
  verifyEmail as verifyEmailRequest,
  waitForSessionBootstrap,
} from '@/lib/api/auth';
import {
  setRefreshCallbacks,
  startProactiveRefresh,
  stopProactiveRefresh,
} from '@/lib/api/auth-refresh';
import { bootstrapCsrf } from '@/lib/api/client';
import { isServerValidatedSession, isSessionBootstrapLoading } from '@/lib/auth/session-state';
import { cacheKeys, clearAppCache, getCached, MAX_CACHE_TTL, setCached } from '@/lib/cache';
import { skipsSessionBootstrap } from '@/lib/navigation/public-routes';
import { goToHref, resolvePostAuthHref } from '@/lib/navigation/resolve-post-auth-href';
import { authPageUrl } from '@/lib/navigation/tenant-routes';
import { queryKeys } from '@/lib/query/keys';
import type { LoginInput, SignupInput, User } from '@/lib/schemas/auth';
import type { SessionBootstrap } from '@/lib/schemas/session-bootstrap';
import type { Tenant } from '@/lib/schemas/tenant';

interface AuthContextType {
  user: User | null;
  workspaces: Tenant[];
  paymentsEnabled: boolean;
  featureGatingEnabled: boolean;
  hasResolvedSession: boolean;
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
  const currentPathname = typeof window === 'undefined' ? pathname : window.location.pathname;
  const sessionBootstrapEnabled = !skipsSessionBootstrap(currentPathname);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const cachedSession = useMemo(() => {
    if (!hasHydrated || !sessionBootstrapEnabled) return null;
    return getCached<SessionBootstrap>(cacheKeys.auth.session);
  }, [hasHydrated, sessionBootstrapEnabled]);

  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: async () => {
      const bootstrap = await getSession();
      if (bootstrap) {
        setCached(cacheKeys.auth.session, bootstrap, { ttl: MAX_CACHE_TTL });
        queryClient.setQueryData(queryKeys.tenants.all, bootstrap.workspaces);
      }
      return bootstrap;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
    enabled: sessionBootstrapEnabled,
    placeholderData: cachedSession ?? undefined,
  });

  const hasResolvedSession =
    sessionBootstrapEnabled &&
    sessionQuery.isFetched &&
    !sessionQuery.isPlaceholderData &&
    Boolean(sessionQuery.data);

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

  const navigateAfterAuth = useCallback(
    async (bootstrap: SessionBootstrap) => {
      queryClient.setQueryData(queryKeys.auth.session, bootstrap);
      queryClient.setQueryData(queryKeys.tenants.all, bootstrap.workspaces);

      const redirect = readRedirectParam();
      const href = await resolvePostAuthHref({
        tenants: bootstrap.workspaces,
        paymentsEnabled: bootstrap.paymentsEnabled,
        redirect,
      });
      goToHref(href, router.push);
    },
    [queryClient, router],
  );

  const loginMutation = useMutation({
    mutationFn: loginRequest,
    onSuccess: async (bootstrap) => {
      setCached(cacheKeys.auth.session, bootstrap, { ttl: MAX_CACHE_TTL });
      queryClient.setQueryData(queryKeys.auth.session, bootstrap);
      queryClient.setQueryData(queryKeys.tenants.all, bootstrap.workspaces);
      await bootstrapCsrf();
      toast.success(<ToastMessage title="Login Successful" description="Welcome back!" />);
      await navigateAfterAuth(bootstrap);
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
      const bootstrap = await verifyEmailRequest(email, code);
      setCached(cacheKeys.auth.session, bootstrap, { ttl: MAX_CACHE_TTL });
      queryClient.setQueryData(queryKeys.auth.session, bootstrap);
      queryClient.setQueryData(queryKeys.tenants.all, bootstrap.workspaces);

      const redirect = readRedirectParam();
      const href = await resolvePostAuthHref({
        tenants: bootstrap.workspaces,
        paymentsEnabled: bootstrap.paymentsEnabled,
        redirect,
      });
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
  }, [queryClient]);

  const sessionUser = sessionQuery.data ? mapSessionUser(sessionQuery.data) : null;

  const value = useMemo<AuthContextType>(
    () => ({
      user: sessionUser,
      workspaces: sessionQuery.data?.workspaces ?? [],
      paymentsEnabled: sessionQuery.data?.paymentsEnabled ?? false,
      featureGatingEnabled: sessionQuery.data?.featureGatingEnabled ?? false,
      hasResolvedSession,
      login: async (input) => {
        await loginMutation.mutateAsync(input);
      },
      register: async (input) => {
        return registerMutation.mutateAsync(input);
      },
      verifyEmail,
      logout,
      isAuthenticated: isServerValidatedSession(sessionUser, sessionQuery.isPlaceholderData),
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
      sessionUser,
      hasResolvedSession,
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

// Used by OAuth completion when cookies attach after redirect.
export { waitForSessionBootstrap };
