import { apiClient, ensureCsrfToken } from '@/lib/api/client';
import { getBrowserTimezone } from '@/lib/geo/browser-region';
import {
  type OnboardingCompleteInput,
  type OnboardingResult,
  type PricingPreview,
  pricingPreviewSchema,
  type SlugAvailability,
  slugAvailabilitySchema,
} from '@/lib/schemas/onboarding';
import { persistTenantId, persistTenantSlug } from '@/lib/session';

export async function fetchPricingPreview(countryCode?: string): Promise<PricingPreview> {
  const params = new URLSearchParams();
  if (countryCode) params.set('country', countryCode);
  const timezone = getBrowserTimezone();
  if (timezone) params.set('timezone', timezone);
  const query = params.toString() ? `?${params.toString()}` : '';
  const data = await apiClient<unknown>(`/onboarding/pricing-preview${query}`, {
    skipCsrf: true,
  });
  return pricingPreviewSchema.parse(data);
}

export async function checkSlugAvailability(slug: string): Promise<SlugAvailability> {
  const query = new URLSearchParams({ slug });
  const data = await apiClient<unknown>(`/onboarding/slug-availability?${query.toString()}`, {
    skipCsrf: true,
  });
  return slugAvailabilitySchema.parse(data);
}

export async function completeOnboarding(
  input: OnboardingCompleteInput,
): Promise<OnboardingResult> {
  await ensureCsrfToken(true);
  const result = await apiClient<OnboardingResult>('/onboarding/complete', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (result.tenant?.id) {
    persistTenantId(result.tenant.id);
  }
  if (result.tenant?.slug) {
    persistTenantSlug(result.tenant.slug);
  }
  return result;
}
