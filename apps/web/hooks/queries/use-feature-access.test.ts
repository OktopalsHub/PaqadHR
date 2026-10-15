import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FeatureAccess } from '@/lib/constants/feature-access';
import type { BillingOverview } from '@/lib/schemas/subscription';
import { useFeatureAccess } from './use-feature-access.ts';

function createBillingOverviewFixture(overrides: Partial<BillingOverview> = {}): BillingOverview {
  return {
    paymentsEnabled: true,
    payrollGatewayEnabled: true,
    featureGatingEnabled: false,
    entitled: true,
    needsPayment: false,
    subscription: null,
    seatCount: 1,
    countryCode: 'US',
    currency: 'USD',
    canManageBilling: true,
    plans: [],
    ...overrides,
  };
}

function renderUseFeatureAccess(queryResult: {
  data?: BillingOverview;
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
    data: createBillingOverviewFixture({
      featureGatingEnabled: true,
      subscription: {
        plan: 'Growth',
        status: 'active',
        trialEndsAt: null,
        isOnTrial: false,
        daysRemaining: null,
        currentPeriodEnd: '2026-09-02T00:00:00.000Z',
      },
      plans: [
        {
          planId: 'plan_growth',
          planPriceId: 'price_growth_usd',
          slug: 'growth',
          name: 'Growth',
          description: null,
          currency: 'USD',
          seatCount: 1,
          monthlyTotal: 5,
          pricePerSeat: 5,
          breakdown: {
            basePrice: 5,
            overagePrice: 0,
            totalPrice: 5,
            overageUsers: 0,
          },
          features: {
            INTEGRATIONS: true,
            ATTENDANCE: false,
          },
          limits: {},
        },
      ],
    }),
  });

  assert.equal(result.isLoading, false);
  assert.equal(result.currentPlan, 'growth');
  assert.equal(result.featureGatingEnabled, true);
  assert.equal(result.hasFeature(FeatureAccess.INTEGRATIONS), true);
  assert.equal(result.hasFeature(FeatureAccess.ATTENDANCE), false);
});

test('unknown plans fall back to no feature entitlements when gating is enabled', () => {
  const result = renderUseFeatureAccess({
    data: createBillingOverviewFixture({
      featureGatingEnabled: true,
      subscription: {
        plan: 'enterprise',
        status: 'active',
        trialEndsAt: null,
        isOnTrial: false,
        daysRemaining: null,
        currentPeriodEnd: '2026-09-02T00:00:00.000Z',
      },
      plans: [
        {
          planId: 'plan_growth',
          planPriceId: 'price_growth_usd',
          slug: 'growth',
          name: 'Growth',
          description: null,
          currency: 'USD',
          seatCount: 1,
          monthlyTotal: 5,
          pricePerSeat: 5,
          breakdown: {
            basePrice: 5,
            overagePrice: 0,
            totalPrice: 5,
            overageUsers: 0,
          },
          features: {
            INTEGRATIONS: true,
          },
          limits: {},
        },
      ],
    }),
  });

  assert.equal(result.currentPlan, null);
  assert.equal(result.hasFeature(FeatureAccess.INTEGRATIONS), false);
});
