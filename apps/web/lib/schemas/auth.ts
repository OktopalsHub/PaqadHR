import { z } from 'zod';
import { STRONG_PASSWORD_MESSAGE } from '@/lib/password-policy';

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
});

export type User = z.infer<typeof userSchema>;

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  email: emailField,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, STRONG_PASSWORD_MESSAGE)
    .regex(/[a-z]/, STRONG_PASSWORD_MESSAGE)
    .regex(/\d/, STRONG_PASSWORD_MESSAGE)
    .regex(/[^A-Za-z0-9\s]/, STRONG_PASSWORD_MESSAGE),
  agreeToTerms: z.boolean().refine((value) => value, {
    message: 'You must agree to the terms and conditions',
  }),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, STRONG_PASSWORD_MESSAGE)
      .regex(/[a-z]/, STRONG_PASSWORD_MESSAGE)
      .regex(/\d/, STRONG_PASSWORD_MESSAGE)
      .regex(/[^A-Za-z0-9\s]/, STRONG_PASSWORD_MESSAGE),
    confirmPassword: z.string().min(8, 'Password must be at least 8 characters'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
