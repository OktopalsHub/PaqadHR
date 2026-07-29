'use client';

import { useMemo } from 'react';
import { useBillingOverview } from '@/hooks/queries/use-billing';
import { FeatureAccess } from '@/lib/constants/feature-access';
import { getFeatureTier } from '@/lib/constants/feature-tier-map';
import { isPlanSlug, PLAN_SLUG_ORDER, type PlanSlug } from '@/lib/constants/plan-catalog';

export function useFeatureAccess() {
  const overviewQuery = useBillingOverview();
  const { data: overview } = overviewQuery;
  const featureGatingEnabled = overview?.featureGatingEnabled ?? false;
  const isLoading = overviewQuery.isLoading || overviewQuery.isPending;

  const currentPlan = useMemo<null | PlanSlug>(() => {
    const plan = overview?.subscription?.plan?.toLowerCase();
    return plan && isPlanSlug(plan) ? plan : null;
  }, [overview?.subscription?.plan]);

  const features = useMemo(() => {
    const currentPlan = overview?.plans?.find(
      (plan) => plan.slug === overview?.subscription?.plan?.toLowerCase(),
    );
    return currentPlan?.features ?? {};
  }, [overview]);

  const hasFeature = useMemo(
    () =>
      (feature: FeatureAccess): boolean => {
        if (!featureGatingEnabled || feature === FeatureAccess.PAYROLL) {
          return true;
        }

        if (feature in features) {
          return Boolean(features[feature]);
        }

        if (!currentPlan) {
          return false;
        }

        const requiredTier = getFeatureTier(feature);
        if (!requiredTier) {
          return false;
        }

        return PLAN_SLUG_ORDER.indexOf(currentPlan) >= PLAN_SLUG_ORDER.indexOf(requiredTier);
      },
    [currentPlan, featureGatingEnabled, features],
  );

  return { currentPlan, hasFeature, featureGatingEnabled, isLoading };
}
