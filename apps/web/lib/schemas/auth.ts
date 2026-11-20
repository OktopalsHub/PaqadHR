import { z } from 'zod';

import { MIN_PASSWORD_LENGTH, PASSWORD_MIN_LENGTH_MESSAGE } from '@/lib/password-policy';

const emailField = z
  .string()
  .email('Please enter a valid email address')
  .transform((value) => value.trim().toLowerCase());

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.string(),
  needsOnboarding: z.boolean().optional(),
  hasPassword: z.boolean().optional(),
});

export type User = z.infer<typeof userSchema>;

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema> & { rememberMe?: boolean };

export const signupSchema = z.object({
  email: emailField,
  password: z.string().min(MIN_PASSWORD_LENGTH, PASSWORD_MIN_LENGTH_MESSAGE),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z.string().min(MIN_PASSWORD_LENGTH, PASSWORD_MIN_LENGTH_MESSAGE),
    confirmPassword: z.string().min(MIN_PASSWORD_LENGTH, PASSWORD_MIN_LENGTH_MESSAGE),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
