'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, type ReactNode, useCallback, useContext, useMemo } from 'react';
import { toast } from 'sonner';
import { ToastMessage } from '@/components/toast-message';
import {
  clearSession,
  getSession,
  login as loginRequest,
  logoutRequest,
  register as registerRequest,
} from '@/lib/api/auth';
import { bootstrapCsrf, clearCsrfToken } from '@/lib/api/client';
import { fetchUserTenants } from '@/lib/api/tenants';
import { skipsSessionBootstrap } from '@/lib/navigation/public-routes';
import {
  authDestinationToPath,
  resolveAuthDestination,
} from '@/lib/navigation/resolve-auth-destination';
import { queryKeys } from '@/lib/query/keys';
import type { LoginInput, SignupInput, User } from '@/lib/schemas/auth';
import { readSession } from '@/lib/session';

interface AuthContextType {
  user: User | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: SignupInput) => Promise<void>;
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
  const sessionBootstrapEnabled = !skipsSessionBootstrap(pathname);

  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: getSession,
    staleTime: Infinity,
    enabled: sessionBootstrapEnabled,
    placeholderData: () => readSession() ?? undefined,
  });

  const navigateAfterAuth = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all });

    const tenants = await queryClient.fetchQuery({
      queryKey: queryKeys.tenants.all,
      queryFn: fetchUserTenants,
    });

    queryClient.setQueryData(queryKeys.tenants.all, tenants);

    const redirect = readRedirectParam();
    const destination = resolveAuthDestination({
      isAuthenticated: true,
      tenants,
      redirect,
    });
    router.push(authDestinationToPath(destination));
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
    onSuccess: async (user) => {
      queryClient.setQueryData(queryKeys.auth.session, user);
      await bootstrapCsrf();
      toast.success(
        <ToastMessage
          title="Registration Successful"
          description="Your account has been created!"
        />,
      );
      await navigateAfterAuth();
    },
    onError: (error: Error) => {
      toast.error(<ToastMessage title="Registration Failed" description={error.message} />);
    },
  });

  const logout = useCallback(() => {
    void logoutRequest().finally(() => {
      clearSession();
      clearCsrfToken();
      queryClient.setQueryData(queryKeys.auth.session, null);
      queryClient.removeQueries({ queryKey: queryKeys.tenants.all });
    });
    router.push('/signin');
    toast(<ToastMessage title="Logout Successful" description="You have been logged out" />);
  }, [queryClient, router]);

  const value = useMemo<AuthContextType>(
    () => ({
      user: sessionQuery.data ?? null,
      login: async (input) => {
        await loginMutation.mutateAsync(input);
      },
      register: async (input) => {
        await registerMutation.mutateAsync(input);
      },
      logout,
      isAuthenticated: Boolean(sessionQuery.data),
      isLoading: sessionQuery.isLoading || loginMutation.isPending || registerMutation.isPending,
    }),
    [sessionQuery.data, sessionQuery.isLoading, loginMutation, registerMutation, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
