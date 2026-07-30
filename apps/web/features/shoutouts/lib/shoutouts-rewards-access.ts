export function getShoutoutsRewardsAccessState<TFeature extends string>(params: {
  featureAccessLoading: boolean;
  featureGatingEnabled: boolean;
  hasFeature: (feature: TFeature) => boolean;
  integrationsFeature: TFeature;
}) {
  if (params.featureAccessLoading) {
    return {
      canAccessRewards: false,
      rewardsCatalogPrefetchEnabled: false,
      showRewardsContent: false,
    };
  }

  const canAccessRewards =
    !params.featureGatingEnabled || params.hasFeature(params.integrationsFeature);

  return {
    canAccessRewards,
    rewardsCatalogPrefetchEnabled: canAccessRewards,
    showRewardsContent: canAccessRewards,
  };
}
