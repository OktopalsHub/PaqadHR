"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ToastMessage } from "@/components/toast-message";
import {
  clearSession,
  getSession,
  login as loginRequest,
  logoutRequest,
  register as registerRequest,
} from "@/lib/api/auth";
import { queryKeys } from "@/lib/query/keys";
import type { LoginInput, SignupInput, User } from "@/lib/schemas/auth";

interface AuthContextType {
  user: User | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: SignupInput) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: getSession,
    staleTime: Infinity,
  });

  const loginMutation = useMutation({
    mutationFn: loginRequest,
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.auth.session, user);
      toast.success(
        <ToastMessage title="Login Successful" description="Welcome back!" />,
      );
      router.push("/app");
    },
    onError: (error: Error) => {
      toast.error(
        <ToastMessage title="Login Failed" description={error.message} />,
      );
    },
  });

  const registerMutation = useMutation({
    mutationFn: registerRequest,
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.auth.session, user);
      toast.success(
        <ToastMessage
          title="Registration Successful"
          description="Your account has been created!"
        />,
      );
      router.push(user.needsOnboarding ? "/onboarding" : "/app");
    },
    onError: (error: Error) => {
      toast.error(
        <ToastMessage title="Registration Failed" description={error.message} />,
      );
    },
  });

  const logout = useCallback(() => {
    void logoutRequest().finally(() => {
      clearSession();
      queryClient.setQueryData(queryKeys.auth.session, null);
      queryClient.removeQueries({ queryKey: queryKeys.tenants.all });
    });
    router.push("/signin");
    toast(
      <ToastMessage
        title="Logout Successful"
        description="You have been logged out"
      />,
    );
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
      isLoading:
        sessionQuery.isLoading ||
        loginMutation.isPending ||
        registerMutation.isPending,
    }),
    [
      sessionQuery.data,
      sessionQuery.isLoading,
      loginMutation,
      registerMutation,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
