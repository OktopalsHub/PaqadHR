import { z } from 'zod';

export const billingStatusSchema = z.object({
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

export const billingPlanQuoteSchema = z.object({
  planId: z.string(),
  planPriceId: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  currency: z.string(),
  seatCount: z.number(),
  monthlyTotal: z.number(),
  pricePerSeat: z.number(),
  breakdown: z.object({
    basePrice: z.number(),
    overagePrice: z.number(),
    totalPrice: z.number(),
    overageUsers: z.number(),
  }),
  features: z.record(z.string(), z.boolean()),
  limits: z.record(z.string(), z.number()),
});

export const billingOverviewSchema = billingStatusSchema.extend({
  seatCount: z.number(),
  countryCode: z.string(),
  currency: z.string(),
  canManageBilling: z.boolean(),
  plans: z.array(billingPlanQuoteSchema),
});

export const checkoutResponseSchema = z.object({
  id: z.string(),
  checkoutUrl: z.string(),
  reference: z.string(),
  planSlug: z.string(),
  seatCount: z.number(),
  amount: z.number(),
  currency: z.string(),
});

export type BillingStatus = z.infer<typeof billingStatusSchema>;
export type BillingOverview = z.infer<typeof billingOverviewSchema>;
export type BillingPlanQuote = z.infer<typeof billingPlanQuoteSchema>;
export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;
