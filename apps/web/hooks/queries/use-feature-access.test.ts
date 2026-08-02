import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FeatureAccess } from '@/lib/constants/feature-access';
import { useFeatureAccess } from './use-feature-access.ts';

function renderUseFeatureAccess(queryResult: {
  data?: any;
  isLoading?: boolean;
  isPending?: boolean;
}) {
  let result: ReturnType<typeof useFeatureAccess> | undefined;

  function TestComponent() {
    result = useFeatureAccess({
      useBillingOverview: () => ({
        data: queryResult.data,
        isLoading: queryResult.isLoading ?? false,
        isPending: queryResult.isPending ?? false,
      }),
    });

    return createElement('div');
  }

  renderToStaticMarkup(createElement(TestComponent));
  assert.ok(result);
  return result;
}

test('feature access stays open while the billing overview is still loading', () => {
  const result = renderUseFeatureAccess({
    isPending: true,
  });

  assert.equal(result.isLoading, true);
  assert.equal(result.currentPlan, null);
  assert.equal(result.featureGatingEnabled, false);
  assert.equal(result.hasFeature(FeatureAccess.ADVANCED_REPORTING), true);
});

test('feature access resolves against the active plan feature map', () => {
  const result = renderUseFeatureAccess({
    data: {
      featureGatingEnabled: true,
      subscription: {
        plan: 'Growth',
      },
      plans: [
        {
          slug: 'growth',
          features: {
            INTEGRATIONS: true,
            ATTENDANCE: false,
          },
        },
      ],
    },
  });

  assert.equal(result.isLoading, false);
  assert.equal(result.currentPlan, 'growth');
  assert.equal(result.featureGatingEnabled, true);
  assert.equal(result.hasFeature(FeatureAccess.INTEGRATIONS), true);
  assert.equal(result.hasFeature(FeatureAccess.ATTENDANCE), false);
});

test('unknown plans fall back to no feature entitlements when gating is enabled', () => {
  const result = renderUseFeatureAccess({
    data: {
      featureGatingEnabled: true,
      subscription: {
        plan: 'enterprise',
      },
      plans: [
        {
          slug: 'growth',
          features: {
            INTEGRATIONS: true,
          },
        },
      ],
    },
  });

  assert.equal(result.currentPlan, null);
  assert.equal(result.hasFeature(FeatureAccess.INTEGRATIONS), false);
});
