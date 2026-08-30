'use client';

import { useMemo } from 'react';
import { useBillingOverview } from '@/hooks/queries/use-billing';
import type { FeatureAccess } from '@/lib/constants/feature-access';
import {
  type FeatureAccessMap,
  hasPlanFeatureAccess,
} from '@/lib/constants/feature-access-resolver';
import { isPlanSlug, type PlanSlug } from '@/lib/constants/plan-catalog';

type FeatureAccessOverviewQuery = Pick<
  ReturnType<typeof useBillingOverview>,
  'data' | 'isLoading' | 'isPending'
>;

type FeatureAccessDependencies = {
  useBillingOverview: () => FeatureAccessOverviewQuery;
};

const defaultFeatureAccessDependencies: FeatureAccessDependencies = {
  useBillingOverview,
};

export function useFeatureAccess(
  dependencies: FeatureAccessDependencies = defaultFeatureAccessDependencies,
) {
  const overviewQuery = dependencies.useBillingOverview();
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

  const featuresKey = JSON.stringify(features);

  const hasFeature = useMemo(
    () =>
      (feature: FeatureAccess): boolean => {
        if (!featureGatingEnabled) {
          return true;
        }

        const parsed = JSON.parse(featuresKey) as FeatureAccessMap;
        return hasPlanFeatureAccess(parsed, feature);
      },
    [featureGatingEnabled, featuresKey],
  );

  return { currentPlan, hasFeature, featureGatingEnabled, isLoading };
}
