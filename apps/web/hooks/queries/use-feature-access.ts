'use client';

import { useMemo } from 'react';
import { useBillingOverview } from '@/hooks/queries/use-billing';
import type { FeatureAccess } from '@/lib/constants/feature-access';
import { isPlanSlug, type PlanSlug } from '@/lib/constants/plan-catalog';
import { hasPlanFeatureAccess } from '../../../../constants/feature-access-resolver';

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
        if (!featureGatingEnabled) {
          return true;
        }

        return hasPlanFeatureAccess(features, feature);
      },
    [featureGatingEnabled, features],
  );

  return { currentPlan, hasFeature, featureGatingEnabled, isLoading };
}
