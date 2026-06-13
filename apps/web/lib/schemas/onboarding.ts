import { z } from "zod";

export const pricingPreviewSchema = z.object({
  detectedCountry: z.string(),
  currency: z.string(),
  detectionMethod: z.string(),
  pricing: z.array(
    z.object({
      plan: z.object({
        slug: z.string(),
        name: z.string(),
        description: z.string().nullable().optional(),
      }),
      price: z.object({
        monthlyPrice: z.union([z.number(), z.string()]),
        currency: z.string(),
      }),
    }),
  ),
});

export type PricingPreview = z.infer<typeof pricingPreviewSchema>;

export const onboardingCompleteInputSchema = z.object({
  name: z.string().min(2),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  businessCountry: z.string().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  preferredName: z.string().optional(),
  jobTitle: z.string().min(2),
});

export type OnboardingCompleteInput = z.infer<
  typeof onboardingCompleteInputSchema
>;

export const onboardingResultSchema = z.object({
  tenant: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string().optional(),
  }),
  pricingRegion: z.object({
    countryCode: z.string(),
    currency: z.string(),
    detectionMethod: z.string(),
    isLocked: z.boolean(),
  }),
  subscription: z
    .object({
      plan: z.string(),
      status: z.string(),
      trialEndsAt: z.string().nullable().optional(),
    })
    .optional(),
});

export type OnboardingResult = z.infer<typeof onboardingResultSchema>;
