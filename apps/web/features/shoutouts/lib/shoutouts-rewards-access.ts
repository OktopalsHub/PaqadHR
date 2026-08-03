export function getShoutoutsRewardsAccessState<TFeature extends string>(params: {
  activeTab: 'feed' | 'tasks' | 'redeem';
  featureAccessLoading: boolean;
  featureGatingEnabled: boolean;
  hasFeature: (feature: TFeature) => boolean;
  integrationsFeature: TFeature;
}) {
  if (params.featureAccessLoading) {
    return {
      canAccessShoutouts: false,
      canAccessRewards: false,
      feedQueriesEnabled: false,
      rewardsCatalogPrefetchEnabled: false,
      showRewardsContent: false,
    };
  }

  const canAccessShoutouts =
    !params.featureGatingEnabled || params.hasFeature(params.integrationsFeature);
  const feedQueriesEnabled = canAccessShoutouts && params.activeTab === 'feed';

  return {
    canAccessShoutouts,
    canAccessRewards: canAccessShoutouts,
    feedQueriesEnabled,
    rewardsCatalogPrefetchEnabled: canAccessShoutouts,
    showRewardsContent: canAccessShoutouts,
  };
}
