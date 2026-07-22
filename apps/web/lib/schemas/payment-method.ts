import { z } from 'zod';

const CRYPTO_CURRENCIES = ['BTC', 'ETH', 'USDT', 'USDC'] as const;

export function isCryptoCurrency(code: string): boolean {
  return CRYPTO_CURRENCIES.includes(code.toUpperCase() as (typeof CRYPTO_CURRENCIES)[number]);
}

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

export const createPaymentMethodInputSchema = z
  .object({
    type: z.enum(['bank', 'crypto']).optional(),
    currency: z.string().min(3).max(10),
    displayName: z.string().max(255).optional(),
    bankName: z.string().max(120).optional(),
    bankCode: z.string().max(20).optional(),
    accountName: z.string().max(160).optional(),
    accountNumber: z.string().max(128).optional(),
    walletAddress: z.string().max(128).optional(),
    cryptoNetwork: z.string().max(32).optional(),
    country: z.string().length(2).optional(),
    passcode: z.string().length(6),
    otpProof: z.string().min(1),
    isPrimary: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const crypto = data.type === 'crypto' || isCryptoCurrency(data.currency);
    if (crypto) {
      if (!(data.walletAddress ?? data.accountNumber)?.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Wallet address is required',
          path: ['walletAddress'],
        });
      }
      return;
    }
    if (!data.bankName?.trim() || !data.accountName?.trim() || !data.accountNumber?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Bank details are required', path: ['bankName'] });
    }
    if (!data.country?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Country is required', path: ['country'] });
    }
  });

export type CreatePaymentMethodInput = z.infer<typeof createPaymentMethodInputSchema>;

export const supportedCurrenciesSchema = z.object({
  fiat: z.array(z.string()),
  crypto: z.array(z.string()).optional(),
});
