'use client';

import { X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useBillingOverview } from '@/hooks/queries/use-billing';
import { getPlansForFeature } from '@/lib/constants/feature-tier-map';
import { PLAN_CATALOG } from '@/lib/constants/plan-catalog';
import { getFeatureForRoute } from '@/lib/constants/route-feature-map';
import { useTenant } from '@/providers/tenant-provider';

export function UpgradePrompt({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { tenant } = useTenant();
  const { data: overview } = useBillingOverview();
  const [dismissed, setDismissed] = useState(false);

  const feature = getFeatureForRoute(pathname);
  const currentPlan = overview?.subscription?.plan?.toLowerCase();
  const plansForFeature = feature ? getPlansForFeature(feature, currentPlan ?? 'starter') : [];

  const sortedPlans = useMemo(() => {
    if (!overview?.plans) return [];
    return overview.plans
      .filter((plan) => plansForFeature.includes(plan.slug))
      .sort((a, b) => {
        const orderA = PLAN_CATALOG[a.slug as keyof typeof PLAN_CATALOG]?.sortOrder ?? 99;
        const orderB = PLAN_CATALOG[b.slug as keyof typeof PLAN_CATALOG]?.sortOrder ?? 99;
        return orderA - orderB;
      });
  }, [overview?.plans, plansForFeature]);

  const hasAccess = useMemo(() => {
    if (!feature) return true;
    return plansForFeature.length === 0;
  }, [feature, plansForFeature.length]);

  const handleUpgrade = useCallback(
    (planSlug: string) => {
      if (!tenant?.slug) return;
      window.location.assign(`/${tenant.slug}/subscribe?plan=${planSlug}`);
    },
    [tenant?.slug],
  );

  if (hasAccess || dismissed) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-svh">
      <div className="pointer-events-none filter blur-sm select-none">{children}</div>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md">
        <div className="rounded-lg border border-border/60 bg-card p-6 max-w-lg w-full mx-4 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Upgrade Required</h2>
            <Button variant="ghost" size="icon" onClick={() => setDismissed(true)}>
              <X className="size-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            This feature is not available on your current plan. Upgrade your workspace to access it.
          </p>
          <div className="grid gap-3">
            {sortedPlans.map((plan) => {
              const isCurrent = currentPlan === plan.slug;
              return (
                <div
                  key={plan.planPriceId}
                  className="flex items-center justify-between rounded-lg border border-border/60 p-3"
                >
                  <div>
                    <p className="font-medium capitalize">{plan.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {plan.seatCount} seat
                      {plan.seatCount !== 1 ? 's' : ''} · ${plan.pricePerSeat}/seat/mo
                    </p>
                  </div>
                  {isCurrent ? (
                    <Button className="w-24" size="sm" disabled>
                      Current
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => handleUpgrade(plan.slug)}>
                      Upgrade
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
