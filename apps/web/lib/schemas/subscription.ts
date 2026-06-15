import { z } from 'zod';

export const billingStatusSchema = z.object({
  billingMode: z.enum(['trial', 'manual', 'open']),
  paymentsEnabled: z.boolean(),
  featureGatingEnabled: z.boolean(),
  subscription: z
    .object({
      status: z.string(),
      plan: z.string(),
      trialEndsAt: z.string().nullable(),
      isOnTrial: z.boolean(),
      daysRemaining: z.number().nullable(),
      currentPeriodEnd: z.string(),
    })
    .nullable(),
});

export type BillingStatus = z.infer<typeof billingStatusSchema>;
