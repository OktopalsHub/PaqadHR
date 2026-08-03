'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
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
import { type SignupInput, signupSchema } from '@/lib/schemas/auth';
import { submitHandledAuthAction } from '../lib/submit-handled-auth-action';
import { SocialAuthButtons } from './buttons/social-auth-buttons';
import { PasswordInput } from './form-fields/password-input';

const Register = () => {
  const { register, isLoading } = useAuth();

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      password: '',
      agreeToTerms: false,
    },
  });

  const handleSignupSubmit = form.handleSubmit(async (values) => {
    await submitHandledAuthAction(() => register(values));
  });

  return (
    <div className="space-y-5 sm:space-y-6 xl:min-h-[33.5rem]">
      <div className="space-y-2">
        <h1 className="text-[clamp(1.8rem,2.5vw,2.25rem)] font-semibold tracking-[-0.05em] text-slate-950">
          Create your account
        </h1>
        <p className="max-w-sm text-sm leading-6 text-slate-500">
          Start your 14-day free trial. No card required.
        </p>
      </div>

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
        <form onSubmit={handleSignupSubmit} className="space-y-4.5">
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
                    placeholder="Enter your email"
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

          <FormField
            control={form.control}
            name="agreeToTerms"
            render={({ field }) => (
              <FormItem className="space-y-2 pt-1">
                <div className="flex items-start gap-2">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="text-sm font-medium leading-5 text-slate-500">
                    I agree to the{' '}
                    <Link href="/terms" className="text-primary hover:text-primary/90">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link href="/privacy" className="text-primary hover:text-primary/90">
                      Privacy Policy
                    </Link>
                  </FormLabel>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            variant="brandSolid"
            className="h-11.5 w-full rounded-[16px] text-base font-semibold shadow-[0_22px_40px_-28px_var(--brand-shadow)]"
            disabled={isLoading}
          >
            {isLoading ? 'Creating account...' : 'Create account'}
          </Button>
        </form>
      </Form>

      <p className="pt-1 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link href="/signin" className="font-medium text-primary hover:text-primary/90">
          Sign in
        </Link>
      </p>
    </div>
  );
};

export default Register;
