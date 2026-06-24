'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchPricingPreview } from '@/lib/api/onboarding';
import { queryKeys } from '@/lib/query/keys';

export function usePricingPreview(countryCode?: string) {
  return useQuery({
    queryKey: queryKeys.onboarding.pricing(countryCode),
    queryFn: () => fetchPricingPreview(countryCode),
    staleTime: 5 * 60_000,
    retry: 1,
  });
}
