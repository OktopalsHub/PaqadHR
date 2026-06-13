import { apiClient } from "@/lib/api/client";
import { persistTenantId } from "@/lib/session";
import type {
  OnboardingCompleteInput,
  OnboardingResult,
  PricingPreview,
} from "@/lib/schemas/onboarding";

export async function fetchPricingPreview(
  country?: string,
): Promise<PricingPreview> {
  const query = country ? `?country=${encodeURIComponent(country)}` : "";
  return apiClient<PricingPreview>(`/onboarding/pricing-preview${query}`);
}

export async function completeOnboarding(
  input: OnboardingCompleteInput,
): Promise<OnboardingResult> {
  const result = await apiClient<OnboardingResult>("/onboarding/complete", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (result.tenant?.id) {
    persistTenantId(result.tenant.id);
  }
  return result;
}
