import { z } from 'zod';

export const billingHistoryEntrySchema = z.object({
  date: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: z.enum(['paid', 'pending', 'failed']),
  invoiceId: z.string().nullable(),
  failureReason: z.string().nullable().optional(),
});

export const billingStatusSchema = z.object({
  paymentsEnabled: z.boolean(),
  payrollGatewayEnabled: z.boolean().optional(),
  featureGatingEnabled: z.boolean(),
  entitled: z.boolean(),
  needsPayment: z.boolean(),
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

export const billingContactSchema = z.object({
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});

export const billingOverviewSchema = billingStatusSchema.extend({
  seatCount: z.number(),
  countryCode: z.string(),
  currency: z.string(),
  canManageBilling: z.boolean(),
  plans: z.array(billingPlanQuoteSchema),
  companyName: z.string().optional(),
  nextBillingDate: z.string().nullable().optional(),
  hasPaymentMethodOnFile: z.boolean().optional(),
  billingHistory: z.array(billingHistoryEntrySchema).optional(),
  needsPayment: z.boolean().optional(),
  billingContact: billingContactSchema.optional(),
  ownerEmail: z.string().nullable().optional(),
  paymentMethodBrand: z.string().nullable().optional(),
  paymentMethodLastFour: z.string().nullable().optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
  cancelledAt: z.string().nullable().optional(),
  pausedAt: z.string().nullable().optional(),
  dunningNextRetryAt: z.string().nullable().optional(),
  lastPaymentFailureReason: z.string().nullable().optional(),
  lastPaymentFailureCode: z.string().nullable().optional(),
  billingProvider: z.enum(['nomba', 'bachs', 'polar']).optional(),
  supportsCardUpdate: z.boolean().optional(),
  pricingMismatch: z
    .object({
      expectedCurrency: z.literal('NGN'),
      actualCurrency: z.string(),
      message: z.string(),
    })
    .nullable()
    .optional(),
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
export type BillingHistoryEntry = z.infer<typeof billingHistoryEntrySchema>;
export type BillingOverview = z.infer<typeof billingOverviewSchema>;
export type BillingPlanQuote = z.infer<typeof billingPlanQuoteSchema>;
export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;
