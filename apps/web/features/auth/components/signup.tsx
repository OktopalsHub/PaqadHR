'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { PasswordRequirements } from '@/components/password-requirements';
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
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/use-auth';
import { resendEmailVerification } from '@/lib/api/auth';
import { type SignupInput, signupSchema } from '@/lib/schemas/auth';
import { SocialAuthButtons } from './buttons/social-auth-buttons';
import { PasswordInput } from './form-fields/password-input';

const Register = () => {
  const { register, isLoading } = useAuth();
  const [emailToVerify, setEmailToVerify] = useState<string | null>(null);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      password: '',
      agreeToTerms: false,
    },
  });

  const handleSignupSubmit = form.handleSubmit(async (values) => {
    try {
      const result = await register(values);
      setEmailToVerify(result.email);
    } catch {
      // The auth provider shows a safe, user-facing error message.
    }
  });

  if (emailToVerify) {
    return <EmailVerificationStep email={emailToVerify} onBack={() => setEmailToVerify(null)} />;
  }

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
                    onFocus={() => setIsPasswordFocused(true)}
                    onBlur={() => {
                      field.onBlur();
                      setIsPasswordFocused(false);
                    }}
                  />
                </FormControl>
                {isPasswordFocused ? (
                  <PasswordRequirements password={form.watch('password')} />
                ) : null}
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

function EmailVerificationStep({ email, onBack }: { email: string; onBack: () => void }) {
  const { verifyEmail } = useAuth();
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setIsVerifying(true);
    try {
      await verifyEmail(email, code);
      toast.success('Email verified. Your account is ready.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Invalid or expired verification code');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      await resendEmailVerification(email);
      setCode('');
      toast.success('A new verification code was sent.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to resend verification code');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 xl:min-h-[33.5rem]">
      <div className="space-y-2">
        <h1 className="text-[clamp(1.8rem,2.5vw,2.25rem)] font-semibold tracking-[-0.05em] text-slate-950">
          Verify your email
        </h1>
        <p className="max-w-sm text-sm leading-6 text-slate-500">
          Enter the six-digit code we sent to{' '}
          <span className="font-medium text-slate-700">{email}</span>.
        </p>
      </div>

      <div className="flex justify-center py-2">
        <InputOTP maxLength={6} value={code} onChange={setCode} disabled={isVerifying}>
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <InputOTPSlot key={index} index={index} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>

      <Button
        className="h-11.5 w-full rounded-[16px] text-base font-semibold"
        disabled={code.length !== 6 || isVerifying}
        onClick={() => void handleVerify()}
      >
        {isVerifying ? <Loader2 className="size-4 animate-spin" /> : 'Verify email'}
      </Button>
      <Button
        className="w-full"
        disabled={isResending || isVerifying}
        onClick={() => void handleResend()}
        type="button"
        variant="ghost"
      >
        {isResending ? <Loader2 className="size-4 animate-spin" /> : 'Resend code'}
      </Button>
      <Button className="w-full" onClick={onBack} type="button" variant="link">
        Use a different email address
      </Button>
    </div>
  );
}
