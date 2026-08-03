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
import { resolveAuthDestination } from '@/lib/navigation/resolve-auth-destination';
import { goToHref, resolvePostAuthHref } from '@/lib/navigation/resolve-post-auth-href';
import { type LoginInput, loginSchema } from '@/lib/schemas/auth';
import { useTenant } from '@/providers/tenant-provider';
import { submitHandledAuthAction } from '../lib/submit-handled-auth-action';
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
    void (async () => {
      const href = await resolvePostAuthHref({ tenants, redirect });
      goToHref(href, router.replace);
    })();
  }, [authLoading, isAuthenticated, hasResolvedTenants, tenantLoading, tenants, router]);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const handleLoginSubmit = form.handleSubmit(async (values) => {
    await submitHandledAuthAction(() => login(values));
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
    <div className="space-y-5 sm:space-y-6 xl:min-h-[33.5rem]">
      <div className="space-y-2">
        <h1 className="text-[clamp(1.8rem,2.5vw,2.25rem)] font-semibold tracking-[-0.05em] text-slate-950">
          Sign in
        </h1>
        <p className="max-w-sm text-sm leading-6 text-slate-500">
          Welcome back. Enter your details to continue.
        </p>
      </div>

      {googleSignInFailed && !isAuthenticated && !authLoading ? (
        <Alert
          variant="destructive"
          className="rounded-[20px] border-destructive/20 bg-destructive/5"
        >
          <AlertTitle>Google sign-in incomplete</AlertTitle>
          <AlertDescription>
            Try &quot;Continue with Google&quot; again, or sign in with your email and password.
          </AlertDescription>
        </Alert>
      ) : null}

      <SocialAuthButtons />

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white/90 px-2.5 text-[10px] font-semibold tracking-[0.18em] text-slate-400 sm:px-3">
            Or continue with email
          </span>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={handleLoginSubmit} className="space-y-4.5">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel className="text-[13px] font-semibold tracking-[0.01em] text-slate-700">
                  Email address
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="admin@example.com"
                    className="h-11.5 rounded-[16px] border-slate-200 bg-white/90 px-4 shadow-[0_10px_30px_-28px_rgba(15,23,42,0.45)] focus-visible:ring-[3px] focus-visible:ring-emerald-500/18"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel className="text-[13px] font-semibold tracking-[0.01em] text-slate-700">
                  Password
                </FormLabel>
                <FormControl>
                  <PasswordInput
                    placeholder="Enter your password"
                    className="h-11.5 rounded-[16px] border-slate-200 bg-white/90 px-4 pr-11 shadow-[0_10px_30px_-28px_rgba(15,23,42,0.45)] focus-visible:ring-[3px] focus-visible:ring-emerald-500/18 focus-visible:ring-offset-0"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <FormField
              control={form.control}
              name="rememberMe"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="text-sm font-medium text-slate-500">Remember me</FormLabel>
                </FormItem>
              )}
            />

            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="self-start text-sm font-semibold text-primary hover:text-primary/90 sm:self-auto"
            >
              Forgot password?
            </button>
          </div>

          <Button
            type="submit"
            variant="brandSolid"
            className="h-11.5 w-full rounded-[16px] text-base font-semibold shadow-[0_22px_40px_-28px_var(--brand-shadow)]"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </Form>

      <p className="pt-1 text-center text-sm text-slate-500">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-medium text-primary hover:text-primary/90">
          Sign up
        </Link>
      </p>
    </div>
  );
};
