'use client';

import { CreditCard, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AppPage } from '@/components/app-page';
import { LoadingBlock } from '@/components/loading-block';
import { Button } from '@/components/ui/button';
import { PlanPricingCard } from '@/features/billing/components/plan-pricing-card';
import { useBillingOverview, useCreateSubscriptionCheckout } from '@/hooks/queries/use-billing';
import { sortPlansByTier } from '@/lib/constants/plan-catalog';
import { useTenant } from '@/providers/tenant-provider';

export function SubscribePage() {
  const searchParams = useSearchParams();
  const { tenant } = useTenant();
  const { data: overview, isLoading, isError, error } = useBillingOverview();
  const checkout = useCreateSubscriptionCheckout();
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('billing') === 'success') {
      toast.success('Payment received. Welcome back!');
    }
  }, [searchParams]);

  const sortedPlans = useMemo(() => sortPlansByTier(overview?.plans ?? []), [overview?.plans]);

  const handleCheckout = async (planSlug: string) => {
    setCheckoutPlan(planSlug);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const successUrl =
        origin && tenant?.slug ? `${origin}/${tenant.slug}/subscribe?billing=success` : undefined;
      const result = await checkout.mutateAsync({ planSlug, successUrl });
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start checkout');
    } finally {
      setCheckoutPlan(null);
    }
  };

  if (isLoading) {
    return (
      <AppPage>
        <LoadingBlock />
      </AppPage>
    );
  }

  if (isError || !overview) {
    return (
      <AppPage>
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : 'Unable to load plans'}
        </p>
      </AppPage>
    );
  }

  if (overview.entitled && !overview.needsPayment) {
    return (
      <AppPage>
        <div className="mx-auto max-w-lg space-y-4 text-center py-12">
          <h1 className="text-2xl font-semibold tracking-tight">You&apos;re all set</h1>
          <p className="text-sm text-muted-foreground">
            Your workspace subscription is active. Head back to the dashboard.
          </p>
          {tenant?.slug ? (
            <Button asChild>
              <a href={`/${tenant.slug}`}>Go to workspace</a>
            </Button>
          ) : null}
        </div>
      </AppPage>
    );
  }

  return (
    <AppPage>
      <div className="mx-auto max-w-5xl space-y-8 py-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Choose a plan to continue</h1>
          <p className="text-sm text-muted-foreground">
            {overview.canManageBilling
              ? 'Your trial has ended or payment is required. Subscribe to keep using your workspace.'
              : 'Ask a workspace owner or admin to complete subscription payment.'}
          </p>
          <p className="text-xs text-muted-foreground">
            Payroll included on every plan · Manual pay & bank export are free
          </p>
        </div>

        {sortedPlans.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-3">
            {sortedPlans.map((plan) => {
              const isPending = checkoutPlan === plan.slug && checkout.isPending;
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
                  action={
                    overview.canManageBilling ? (
                      <Button
                        className="w-full"
                        size="sm"
                        disabled={isPending}
                        onClick={() => void handleCheckout(plan.slug)}
                      >
                        {isPending ? (
                          <>
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            Redirecting…
                          </>
                        ) : (
                          'Subscribe'
                        )}
                      </Button>
                    ) : undefined
                  }
                />
              );
            })}
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">No plans available.</p>
        )}

        {!overview.paymentsEnabled ? (
          <p className="text-center text-xs text-muted-foreground">
            Online billing is not configured in this environment.
          </p>
        ) : null}

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <CreditCard className="size-4" />
          Secure checkout
        </div>
      </div>
    </AppPage>
  );
}
