import { z } from 'zod';

export const paymentMethodSummarySchema = z.object({
  id: z.string(),
  type: z.string(),
  currency: z.string(),
  displayInfo: z.string(),
  status: z.string(),
  isPrimary: z.boolean(),
  isVerified: z.boolean(),
  canReceivePayments: z.boolean(),
  lastUsedAt: z.string().nullable().optional(),
  createdAt: z.string(),
});

export type PaymentMethodSummary = z.infer<typeof paymentMethodSummarySchema>;

export const createPaymentMethodInputSchema = z.object({
  currency: z.string().min(3).max(10),
  displayName: z.string().max(255).optional(),
  bankName: z.string().min(1).max(120),
  bankCode: z.string().max(20).optional(),
  accountName: z.string().min(1).max(160),
  accountNumber: z.string().min(1).max(34),
  country: z.string().length(2),
  passcode: z.string().length(6),
  isPrimary: z.boolean().optional(),
});

export type CreatePaymentMethodInput = z.infer<typeof createPaymentMethodInputSchema>;

export const supportedCurrenciesSchema = z.object({
  fiat: z.array(z.string()),
});
