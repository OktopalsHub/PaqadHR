'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { AppPage } from '@/components/app-page';
import { Button } from '@/components/ui/button';
import { useBillingOverview } from '@/hooks/queries/use-billing';
import { ApiError } from '@/lib/api/client';
import { getPlansForFeature } from '@/lib/constants/feature-tier-map';
import { isPlanSlug, PLAN_CATALOG } from '@/lib/constants/plan-catalog';
import { getFeatureForRoute } from '@/lib/constants/route-feature-map';
import { cn } from '@/lib/utils';
import { useTenant } from '@/providers/tenant-provider';

function useUpgradeOptions(feature: string | null) {
  const { tenant } = useTenant();
  const { data: overview } = useBillingOverview();

  const currentPlanSlug = overview?.subscription?.plan?.toLowerCase();
  const currentPlan = currentPlanSlug && isPlanSlug(currentPlanSlug) ? currentPlanSlug : 'starter';
  const plansForFeature = useMemo(
    () => (feature ? getPlansForFeature(feature, currentPlan) : []),
    [currentPlan, feature],
  );

  const sortedPlans = useMemo(() => {
    if (!overview?.plans) return [];
    return overview.plans
      .filter((plan) => isPlanSlug(plan.slug) && plansForFeature.includes(plan.slug))
      .sort((a, b) => {
        const orderA = PLAN_CATALOG[a.slug as keyof typeof PLAN_CATALOG]?.sortOrder ?? 99;
        const orderB = PLAN_CATALOG[b.slug as keyof typeof PLAN_CATALOG]?.sortOrder ?? 99;
        return orderA - orderB;
      });
  }, [overview?.plans, plansForFeature]);

  const handleUpgrade = useCallback(
    (planSlug: string) => {
      if (!tenant?.slug) return;
      window.location.assign(`/${tenant.slug}/subscribe?plan=${planSlug}`);
    },
    [tenant?.slug],
  );

  return { currentPlan, plansForFeature, sortedPlans, handleUpgrade };
}

export function isUpgradeRequiredError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  const hasUpgradeMessage =
    message.includes('not available on your current plan') ||
    message.includes('current plan or trial') ||
    message.includes('upgrade your workspace');

  if (error instanceof ApiError) {
    return (
      hasUpgradeMessage ||
      ((error.status === 402 || error.status === 403) && message.includes('plan'))
    );
  }

  return hasUpgradeMessage;
}

type UpgradeRequiredModalProps = {
  feature: string;
  className?: string;
};

export function UpgradeRequiredPanel({ feature, className }: UpgradeRequiredModalProps) {
  const { currentPlan, plansForFeature, sortedPlans, handleUpgrade } = useUpgradeOptions(feature);
  const fallbackPlan = plansForFeature[0];

  return (
    <section className={cn('dashboard-panel rounded-[8px] p-6 sm:p-8', className)}>
      <div className="flex flex-col gap-6">
        <div className="space-y-3">
          <span className="inline-flex w-fit items-center rounded-full border border-[#d7e3f6] bg-[#eef4ff] px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            Upgrade required
          </span>
          <div className="space-y-2">
            <h2 className="text-[28px] font-semibold tracking-[-0.03em] text-slate-950 dark:text-slate-100">
              Upgrade to access this feature
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              This feature is not available on your current plan. Upgrade your workspace to unlock
              access.
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          {sortedPlans.length > 0 ? (
            sortedPlans.map((plan) => {
              const isCurrent = currentPlan === plan.slug;

              return (
                <div
                  key={plan.planPriceId}
                  className="dashboard-soft-tile flex flex-col gap-4 rounded-[8px] border border-[#d7e3f6] p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800"
                >
                  <div>
                    <p className="text-base font-semibold capitalize text-slate-950 dark:text-slate-100">
                      {plan.name}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {plan.seatCount} seat
                      {plan.seatCount !== 1 ? 's' : ''} · ${plan.pricePerSeat}/seat/mo
                    </p>
                  </div>
                  {isCurrent ? (
                    <Button className="w-full sm:w-24" size="sm" disabled>
                      Current
                    </Button>
                  ) : (
                    <Button
                      className="w-full sm:w-auto"
                      size="sm"
                      onClick={() => handleUpgrade(plan.slug)}
                    >
                      Upgrade
                    </Button>
                  )}
                </div>
              );
            })
          ) : fallbackPlan ? (
            <Button
              className="w-full sm:w-auto sm:self-start"
              onClick={() => handleUpgrade(fallbackPlan)}
            >
              View upgrade options
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function UpgradePrompt({
  children,
  featureOverride,
}: {
  children: React.ReactNode;
  featureOverride?: string | null;
}) {
  const pathname = usePathname();
  const feature = featureOverride ?? getFeatureForRoute(pathname);
  const { plansForFeature } = useUpgradeOptions(feature);

  const hasAccess = useMemo(() => {
    if (!feature) return true;
    return plansForFeature.length === 0;
  }, [feature, plansForFeature.length]);

  if (hasAccess || !feature) {
    return <>{children}</>;
  }

  return (
    <AppPage className="mx-auto w-full max-w-5xl">
      <UpgradeRequiredPanel feature={feature} />
    </AppPage>
  );
}
