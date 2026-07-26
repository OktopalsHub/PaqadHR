'use client';

import { useMemo } from 'react';
import { useBillingOverview } from '@/hooks/queries/use-billing';
import type { FeatureAccess } from '@/lib/constants/feature-access';

export function useFeatureAccess() {
  const { data: overview } = useBillingOverview();

  const features = useMemo(() => {
    const currentPlan = overview?.plans?.find(
      (plan) => plan.slug === overview?.subscription?.plan?.toLowerCase(),
    );
    return currentPlan?.features ?? {};
  }, [overview]);

  const hasFeature = useMemo(
    () =>
      (feature: FeatureAccess): boolean => {
        return Boolean(features[feature]);
      },
    [features],
  );

  return { hasFeature, featureGatingEnabled: overview?.featureGatingEnabled ?? false };
}
