import type { FeatureAccess } from './feature-access';

type SearchParamsLike = {
  get(name: string): string | null;
};

const NO_ROUTE_FEATURE_REQUIRED = Symbol('NO_ROUTE_FEATURE_REQUIRED');

const ROUTE_FEATURES = {
  advancedReporting: 'ADVANCED_REPORTING' as FeatureAccess,
  attendance: 'ATTENDANCE' as FeatureAccess,
  integrations: 'INTEGRATIONS' as FeatureAccess,
  leaveManagement: 'LEAVE_MANAGEMENT' as FeatureAccess,
  recruitment: 'RECRUITMENT' as FeatureAccess,
} as const;

export const ROUTE_FEATURE_MAP: Partial<Record<string, FeatureAccess>> = {
  analytics: ROUTE_FEATURES.advancedReporting,
  integrations: ROUTE_FEATURES.integrations,
  attendance: ROUTE_FEATURES.attendance,
  schedule: ROUTE_FEATURES.attendance,
  calendar: ROUTE_FEATURES.attendance,
  leaves: ROUTE_FEATURES.leaveManagement,
  recruitment: ROUTE_FEATURES.recruitment,
};

const SETTINGS_TAB_FEATURE_MAP: Partial<Record<string, FeatureAccess>> = {
  attendance: ROUTE_FEATURES.attendance,
  integrations: ROUTE_FEATURES.integrations,
  shoutouts: ROUTE_FEATURES.integrations,
  rewards: ROUTE_FEATURES.integrations,
};

const SHOUTOUT_TAB_FEATURE_MAP: Partial<Record<string, FeatureAccess>> = {
  redeem: ROUTE_FEATURES.integrations,
  rewards: ROUTE_FEATURES.integrations,
};

function getScopedTabFeature(
  pathname: string,
  searchParams?: SearchParamsLike | null,
): FeatureAccess | typeof NO_ROUTE_FEATURE_REQUIRED | null {
  const tab = searchParams?.get('tab');

  const segments = pathname.split('/').filter(Boolean);

  if (segments.includes('settings')) {
    if (!tab) return null;
    return SETTINGS_TAB_FEATURE_MAP[tab] ?? null;
  }

  if (segments.includes('shoutouts')) {
    if (!tab) {
      return NO_ROUTE_FEATURE_REQUIRED;
    }

    return SHOUTOUT_TAB_FEATURE_MAP[tab] ?? NO_ROUTE_FEATURE_REQUIRED;
  }

  return null;
}

export function getFeatureForRoute(
  pathname: string,
  searchParams?: SearchParamsLike | null,
): FeatureAccess | null {
  const scopedFeature = getScopedTabFeature(pathname, searchParams);
  if (scopedFeature === NO_ROUTE_FEATURE_REQUIRED) {
    return null;
  }

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
