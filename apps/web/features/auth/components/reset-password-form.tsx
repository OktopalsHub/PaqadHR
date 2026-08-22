'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { PasswordRequirements } from '@/components/password-requirements';
import { ToastMessage } from '@/components/toast-message';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { resetPassword } from '@/lib/api/auth';
import { type ResetPasswordInput, resetPasswordSchema } from '@/lib/schemas/auth';
import { PasswordInput } from './form-fields/password-input';

interface ResetPasswordFormProps {
  token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const router = useRouter();
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const mutation = useMutation({
    mutationFn: (input: ResetPasswordInput) => resetPassword(token, input.password),
    onSuccess: () => {
      toast.success(
        <ToastMessage
          title="Password updated"
          description="You can sign in with your new password."
        />,
      );
      router.push('/signin');
    },
    onError: (error: Error) => {
      toast.error(
        <ToastMessage
          title="Reset failed"
          description={error.message || 'Invalid or expired reset link.'}
        />,
      );
    },
  });

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-xl font-semibold">Invalid reset link</h2>
        <p className="text-sm text-muted-foreground">
          This password reset link is missing or invalid. Request a new one from the sign-in page.
        </p>
        <Button asChild variant="outline">
          <Link href="/signin">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Set a new password</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Create a password that meets all of the requirements below.
        </p>
      </div>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
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
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </Form>
    </div>
  );
}
