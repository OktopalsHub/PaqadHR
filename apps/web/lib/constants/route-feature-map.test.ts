import assert from 'node:assert/strict';
import test from 'node:test';
import { getFeatureForRoute } from './route-feature-map.ts';

function createSearchParams(tab: string | null) {
  return {
    get(name: string) {
      return name === 'tab' ? tab : null;
    },
  };
}

test('shoutouts route stays gated behind integrations access', () => {
  assert.equal(
    getFeatureForRoute('/pikolob/shoutouts', createSearchParams('feed')),
    'INTEGRATIONS',
  );
  assert.equal(
    getFeatureForRoute('/pikolob/shoutouts', createSearchParams('tasks')),
    'INTEGRATIONS',
  );
  assert.equal(getFeatureForRoute('/pikolob/shoutouts', createSearchParams(null)), 'INTEGRATIONS');
  assert.equal(
    getFeatureForRoute('/pikolob/shoutouts', createSearchParams('redeem')),
    'INTEGRATIONS',
  );
  assert.equal(
    getFeatureForRoute('/pikolob/shoutouts', createSearchParams('rewards')),
    'INTEGRATIONS',
  );
});

test('other route-level feature gates stay intact', () => {
  assert.equal(
    getFeatureForRoute('/pikolob/analytics', createSearchParams(null)),
    'ADVANCED_REPORTING',
  );
  assert.equal(
    getFeatureForRoute('/pikolob/settings', createSearchParams('attendance')),
    'ATTENDANCE',
  );
});
