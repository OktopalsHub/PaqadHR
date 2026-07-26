'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { LoadingBlock } from '@/components/loading-block';
import { Button } from '@/components/ui/button';
import { PlanPricingCard } from '@/features/billing/components/plan-pricing-card';
import { useBillingOverview } from '@/hooks/queries/use-billing';
import { useFeatureAccess } from '@/hooks/queries/use-feature-access';
import { getPlansForFeature } from '@/lib/constants/feature-tier-map';
import type { PlanSlug } from '@/lib/constants/plan-catalog';
import { sortPlansByTier } from '@/lib/constants/plan-catalog';
import { getFeatureForRoute } from '@/lib/constants/route-feature-map';

export function UpgradePrompt({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { hasFeature, currentPlan, isLoading: featureLoading } = useFeatureAccess();
  const { data: overview, isLoading: billingLoading } = useBillingOverview();

  const requiredFeature = useMemo(() => getFeatureForRoute(pathname ?? ''), [pathname]);

  const needsUpgrade = useMemo(() => {
    if (!requiredFeature) return false;
    return !hasFeature(requiredFeature);
  }, [requiredFeature, hasFeature]);

  const upgradePlans = useMemo(() => {
    if (!requiredFeature || !currentPlan) return [];
    const plans = getPlansForFeature(requiredFeature, currentPlan as PlanSlug);
    return sortPlansByTier(
      (overview?.plans ?? []).filter((p) => plans.includes(p.slug as PlanSlug)),
    );
  }, [requiredFeature, currentPlan, overview?.plans]);

  if (featureLoading || billingLoading) {
    return (
      <div className="relative">
        <div className="blur-sm pointer-events-none">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center">
          <LoadingBlock />
        </div>
      </div>
    );
  }

  if (!needsUpgrade) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div className="blur-sm pointer-events-none select-none">{children}</div>
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl space-y-6 rounded-lg border bg-background p-8 shadow-lg">
          <div className="space-y-2 text-center">
            <h2 className="text-xl font-semibold tracking-tight">Upgrade Required</h2>
            <p className="text-sm text-muted-foreground">
              This feature requires a higher plan. Upgrade to continue.
            </p>
          </div>

          {upgradePlans.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {upgradePlans.map((plan) => {
                const perSeat = plan.breakdown.basePrice / Math.max(1, plan.seatCount);
                return (
                  <PlanPricingCard
                    key={plan.planPriceId}
                    slug={plan.slug}
                    name={plan.name}
                    description={plan.description}
                    currency={plan.currency}
                    pricePerSeat={perSeat}
                    seatCount={plan.seatCount}
                    monthlyTotal={plan.monthlyTotal}
                    maxEmployees={plan.limits.maxEmployees}
                    isPopular={plan.slug === 'growth'}
                    variant="app"
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground">No upgrade plans available.</p>
          )}

          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => router.back()}>
              Go Back
            </Button>
            <Button onClick={() => router.push('/subscribe')}>Upgrade Plan</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
