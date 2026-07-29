export function getShoutoutsRewardsAccessState(params: {
  featureAccessLoading: boolean;
  featureGatingEnabled: boolean;
  hasFeature: (feature: string) => boolean;
  integrationsFeature: string;
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
