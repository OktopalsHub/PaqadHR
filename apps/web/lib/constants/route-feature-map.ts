import { FeatureAccess } from '@/lib/constants/feature-access';

type SearchParamsLike = {
  get(name: string): string | null;
};

export const ROUTE_FEATURE_MAP: Partial<Record<string, FeatureAccess>> = {
  analytics: FeatureAccess.ADVANCED_REPORTING,
  integrations: FeatureAccess.INTEGRATIONS,
  shoutouts: FeatureAccess.INTEGRATIONS,
  attendance: FeatureAccess.ATTENDANCE,
  schedule: FeatureAccess.ATTENDANCE,
  calendar: FeatureAccess.ATTENDANCE,
  leaves: FeatureAccess.LEAVE_MANAGEMENT,
  recruitment: FeatureAccess.RECRUITMENT,
};

const SETTINGS_TAB_FEATURE_MAP: Partial<Record<string, FeatureAccess>> = {
  attendance: FeatureAccess.ATTENDANCE,
  integrations: FeatureAccess.INTEGRATIONS,
  shoutouts: FeatureAccess.INTEGRATIONS,
  rewards: FeatureAccess.INTEGRATIONS,
};

const SHOUTOUT_TAB_FEATURE_MAP: Partial<Record<string, FeatureAccess>> = {
  redeem: FeatureAccess.INTEGRATIONS,
  rewards: FeatureAccess.INTEGRATIONS,
};

function getScopedTabFeature(
  pathname: string,
  searchParams?: SearchParamsLike | null,
): FeatureAccess | null {
  const tab = searchParams?.get('tab');
  if (!tab) return null;

  const segments = pathname.split('/').filter(Boolean);

  if (segments.includes('settings')) {
    return SETTINGS_TAB_FEATURE_MAP[tab] ?? null;
  }

  if (segments.includes('shoutouts')) {
    return SHOUTOUT_TAB_FEATURE_MAP[tab] ?? null;
  }

  return null;
}

export function getFeatureForRoute(
  pathname: string,
  searchParams?: SearchParamsLike | null,
): FeatureAccess | null {
  const scopedFeature = getScopedTabFeature(pathname, searchParams);
  if (scopedFeature) {
    return scopedFeature;
  }

  const segments = pathname.split('/').filter(Boolean);

  for (const segment of segments) {
    const feature = ROUTE_FEATURE_MAP[segment];
    if (feature) {
      return feature;
    }
  }

  return null;
}
