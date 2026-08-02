export type FeatureAccessMap = Partial<Record<string, boolean>>;

export function hasPlanFeatureAccess(
  planFeatures: FeatureAccessMap | null | undefined,
  feature: string,
): boolean {
  return planFeatures?.[feature] === true;
}

export function hasPlanFeaturesAccess(
  planFeatures: FeatureAccessMap | null | undefined,
  features: readonly string[],
): boolean {
  return features.every((feature) => hasPlanFeatureAccess(planFeatures, feature));
}
