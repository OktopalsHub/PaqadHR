import { z } from 'zod';

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
      currency: z.string(),
      monthlyPrice: z.coerce.number(),
    }),
  ),
});

export type PricingPreview = z.infer<typeof pricingPreviewSchema>;

export const slugAvailabilitySchema = z.object({
  slug: z.string(),
  available: z.boolean(),
  reason: z.enum(['invalid', 'reserved', 'taken']).optional(),
});

export type SlugAvailability = z.infer<typeof slugAvailabilitySchema>;

export const onboardingCompleteInputSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).max(25).optional(),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  businessCountry: z.string().optional(),
  timezone: z.string().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  preferredName: z.string().optional(),
  jobTitle: z.string().min(2),
  planSlug: z.string().min(1).optional(),
  employeeCode: z.string().min(2).max(10).optional(),
});

export type OnboardingCompleteInput = z.infer<typeof onboardingCompleteInputSchema>;

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
