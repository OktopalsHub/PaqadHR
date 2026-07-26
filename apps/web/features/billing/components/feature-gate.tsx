'use client';

import { LoadingBlock } from '@/components/loading-block';
import { useFeatureAccess } from '@/hooks/queries/use-feature-access';

type FeatureGateProps = {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { hasFeature, isLoading } = useFeatureAccess();

  if (isLoading) {
    return <LoadingBlock />;
  }

  if (!hasFeature(feature)) {
    return fallback ? fallback : null;
  }

  return <>{children}</>;
}
