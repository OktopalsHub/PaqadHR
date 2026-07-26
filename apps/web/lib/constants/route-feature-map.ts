export const ROUTE_FEATURE_MAP: Record<string, string> = {
  analytics: 'ADVANCED_REPORTING',
  integrations: 'INTEGRATIONS',
  rewards: 'INTEGRATIONS',
};

export function getFeatureForRoute(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  for (const segment of segments) {
    const feature = ROUTE_FEATURE_MAP[segment];
    if (feature) return feature;
  }
  return null;
}
