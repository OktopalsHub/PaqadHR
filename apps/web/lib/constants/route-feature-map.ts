export const ROUTE_FEATURE_MAP: Record<string, string> = {
  analytics: 'ADVANCED_REPORTING',
  integrations: 'INTEGRATIONS',
  rewards: 'INTEGRATIONS',
  shoutouts: 'INTEGRATIONS',
  attendance: 'ATTENDANCE',
  schedule: 'ATTENDANCE',
  calendar: 'ATTENDANCE',
  leaves: 'LEAVE_MANAGEMENT',
  recruitment: 'RECRUITMENT',
};

export function getFeatureForRoute(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);

  for (const segment of segments) {
    if (segment in ROUTE_FEATURE_MAP) {
      return ROUTE_FEATURE_MAP[segment];
    }
  }

  return null;
}
