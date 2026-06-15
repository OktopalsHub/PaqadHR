import { apiClient } from "@/lib/api/client";
import { persistTenantId, persistTenantSlug } from "@/lib/session";
import {
  slugAvailabilitySchema,
  type SlugAvailability,
} from "@/lib/schemas/onboarding";
import type {
  OnboardingCompleteInput,
  OnboardingResult,
  PricingPreview,
} from "@/lib/schemas/onboarding";

export async function fetchPricingPreview(): Promise<PricingPreview> {
  return apiClient<PricingPreview>("/onboarding/pricing-preview");
}

export async function checkSlugAvailability(
  slug: string,
): Promise<SlugAvailability> {
  const query = new URLSearchParams({ slug });
  const data = await apiClient<unknown>(
    `/onboarding/slug-availability?${query.toString()}`,
    { skipCsrf: true },
  );
  return slugAvailabilitySchema.parse(data);
}

export async function completeOnboarding(
  input: OnboardingCompleteInput,
): Promise<OnboardingResult> {
  const result = await apiClient<OnboardingResult>("/onboarding/complete", {
    method: "POST",
    body: JSON.stringify(input),
    skipCsrf: true,
  });
  if (result.tenant?.id) {
    persistTenantId(result.tenant.id);
  }
  if (result.tenant?.slug) {
    persistTenantSlug(result.tenant.slug);
  }
  return result;
}
