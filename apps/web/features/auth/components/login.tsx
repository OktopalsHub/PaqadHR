'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { LoadingBlock } from '@/components/loading-block';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/use-auth';
import {
  goToAuthDestination,
  resolveAuthDestination,
} from '@/lib/navigation/resolve-auth-destination';
import { type LoginInput, loginSchema } from '@/lib/schemas/auth';
import { useTenant } from '@/providers/tenant-provider';
import { SocialAuthButtons } from './buttons/social-auth-buttons';
import { ForgotPasswordForm } from './forgot-password.form';
import { PasswordInput } from './form-fields/password-input';

export const Login = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const googleSignInFailed = searchParams.get('error') === 'google';
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const { login, isLoading, isAuthenticated, isLoading: authLoading } = useAuth();
  const { tenants, isLoading: tenantLoading, hasResolvedTenants } = useTenant();

  const redirectParam =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('redirect')
      : null;

  const resolvedDestination = resolveAuthDestination({
    isAuthenticated,
    tenants: isAuthenticated && hasResolvedTenants ? tenants : [],
    redirect: redirectParam,
  });

  const isResolvingSession =
    authLoading || (isAuthenticated && (!hasResolvedTenants || tenantLoading));

  const showRedirectSpinner =
    isAuthenticated &&
    hasResolvedTenants &&
    !tenantLoading &&
    resolvedDestination.type !== 'signin';

  useEffect(() => {
    if (!isAuthenticated || !hasResolvedTenants || tenantLoading || authLoading) return;

    const redirect = new URLSearchParams(window.location.search).get('redirect');
    const destination = resolveAuthDestination({ isAuthenticated, tenants, redirect });
    if (destination.type !== 'signin') {
      goToAuthDestination(destination, router.replace);
    }
  }, [authLoading, isAuthenticated, hasResolvedTenants, tenantLoading, tenants, router]);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  if (isResolvingSession || showRedirectSpinner) {
    return (
      <div className="flex min-h-[280px] items-center justify-center">
        <LoadingBlock />
      </div>
    );
  }

  if (showForgotPassword) {
    return <ForgotPasswordForm onBack={() => setShowForgotPassword(false)} />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back. Enter your details to continue.
        </p>
      </div>

      {googleSignInFailed && !isAuthenticated && !authLoading ? (
        <Alert variant="destructive">
          <AlertTitle>Google sign-in incomplete</AlertTitle>
          <AlertDescription>
            Try &quot;Continue with Google&quot; again, or sign in with your email and password.
          </AlertDescription>
        </Alert>
      ) : null}

      <SocialAuthButtons />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((values) => login(values))} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email address</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="admin@example.com" className="h-11" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <PasswordInput placeholder="Enter your password" className="h-11" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex items-center justify-between">
            <FormField
              control={form.control}
              name="rememberMe"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="text-sm font-normal text-muted-foreground">
                    Remember me
                  </FormLabel>
                </FormItem>
              )}
            />

            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm font-medium text-primary hover:text-primary/90"
            >
              Forgot password?
            </button>
          </div>

          <Button type="submit" className="w-full h-11" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-medium text-primary hover:text-primary/90">
          Sign up
        </Link>
      </p>
    </div>
  );
};
