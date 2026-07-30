import assert from 'node:assert/strict';
import test from 'node:test';
import { getShoutoutsRewardsAccessState } from './shoutouts-rewards-access.ts';

test('rewards stay closed while feature access is still loading', () => {
  const state = getShoutoutsRewardsAccessState({
    featureAccessLoading: true,
    featureGatingEnabled: false,
    hasFeature: () => {
      throw new Error('hasFeature should not run while feature access is loading');
    },
    integrationsFeature: 'INTEGRATIONS',
  });

  assert.equal(state.canAccessRewards, false);
  assert.equal(state.rewardsCatalogPrefetchEnabled, false);
  assert.equal(state.showRewardsContent, false);
});

test('rewards open when gating is disabled after feature access resolves', () => {
  const state = getShoutoutsRewardsAccessState({
    featureAccessLoading: false,
    featureGatingEnabled: false,
    hasFeature: () => false,
    integrationsFeature: 'INTEGRATIONS',
  });

  assert.equal(state.canAccessRewards, true);
  assert.equal(state.rewardsCatalogPrefetchEnabled, true);
  assert.equal(state.showRewardsContent, true);
});

test('rewards remain closed when integrations access is denied', () => {
  const state = getShoutoutsRewardsAccessState({
    featureAccessLoading: false,
    featureGatingEnabled: true,
    hasFeature: (feature) => {
      assert.equal(feature, 'INTEGRATIONS');
      return false;
    },
    integrationsFeature: 'INTEGRATIONS',
  });

  assert.equal(state.canAccessRewards, false);
  assert.equal(state.rewardsCatalogPrefetchEnabled, false);
  assert.equal(state.showRewardsContent, false);
});
