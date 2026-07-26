'use client';

import { useCallback, useMemo } from 'react';
import { useBillingOverview } from '@/hooks/queries/use-billing';

export function useFeatureAccess() {
  const { data: overview, isLoading } = useBillingOverview();

  const currentPlan = useMemo(() => {
    if (!overview?.subscription?.plan) return null;
    return overview.subscription.plan;
  }, [overview?.subscription?.plan]);

  const features = useMemo(() => {
    if (!overview?.plans || !currentPlan) return {};
    const plan = overview.plans.find((p) => p.slug === currentPlan);
    return plan?.features ?? {};
  }, [overview?.plans, currentPlan]);

  const hasFeature = useCallback(
    (feature: string): boolean => {
      if (isLoading) return false;
      return features[feature] === true;
    },
    [features, isLoading],
  );

  return { hasFeature, currentPlan, isLoading };
}
