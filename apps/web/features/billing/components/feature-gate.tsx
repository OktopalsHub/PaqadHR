'use client';

import { useFeatureAccess } from '@/hooks/queries/use-feature-access';
import type { FeatureAccess } from '@/lib/constants/feature-access';

export function FeatureGate({
  feature,
  fallback = null,
  children,
}: {
  feature: FeatureAccess;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { hasFeature, featureGatingEnabled } = useFeatureAccess();

  if (featureGatingEnabled && !hasFeature(feature)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
