'use client';

import { CheckCircle2, CreditCard, Loader2, Users } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useBillingOverview, useCreateSubscriptionCheckout } from '@/hooks/queries/use-billing';
import { useTenant } from '@/providers/tenant-provider';

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function BillingSection() {
  const searchParams = useSearchParams();
  const { tenant } = useTenant();
  const { data: overview, isLoading, isError, error } = useBillingOverview();
  const checkout = useCreateSubscriptionCheckout();
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const currentPlanSlug = overview?.subscription?.plan?.toLowerCase();

  useEffect(() => {
    if (searchParams.get('billing') === 'success') {
      setSuccessMessage(
        'Payment received. Your subscription will activate shortly after verification.',
      );
    }
  }, [searchParams]);

  const sortedPlans = useMemo(() => overview?.plans ?? [], [overview?.plans]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading billing details…</p>;
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load billing</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : 'Something went wrong'}
        </AlertDescription>
      </Alert>
    );
  }

  if (!overview) {
    return null;
  }

  const handleCheckout = async (planSlug: string) => {
    setCheckoutPlan(planSlug);
    try {
      const result = await checkout.mutateAsync(planSlug);
      window.location.assign(result.checkoutUrl);
    } finally {
      setCheckoutPlan(null);
    }
  };

  return (
    <div className="space-y-4">
      {successMessage ? (
        <Alert>
          <CheckCircle2 className="size-4" />
          <AlertTitle>Payment submitted</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      <dl className="divide-y divide-border/60">
        <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
          <dt className="text-muted-foreground">Card payments</dt>
          <dd>
            <Badge variant={overview.paymentsEnabled ? 'default' : 'secondary'}>
              {overview.paymentsEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
          <dt className="flex items-center gap-2 text-muted-foreground">
            <Users className="size-3.5" />
            Active seats
          </dt>
          <dd className="font-medium">{overview.seatCount}</dd>
        </div>
        {overview.subscription ? (
          <>
            <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <dt className="text-muted-foreground">Plan</dt>
              <dd className="font-medium capitalize">{overview.subscription.plan}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium capitalize">{overview.subscription.status}</dd>
            </div>
            {overview.subscription.daysRemaining != null ? (
              <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <dt className="text-muted-foreground">Trial remaining</dt>
                <dd className="font-medium">{overview.subscription.daysRemaining} days</dd>
              </div>
            ) : null}
          </>
        ) : null}
      </dl>

      {!overview.paymentsEnabled ? (
        <p className="text-xs text-muted-foreground">
          Online billing is not enabled for this environment. Contact your administrator to activate
          a plan or extend your trial.
        </p>
      ) : null}

      {overview.paymentsEnabled && sortedPlans.length > 0 ? (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CreditCard className="size-4 text-primary" />
            Available plans
          </div>
          <p className="text-xs text-muted-foreground">
            Prices are calculated on the server for {overview.seatCount} active seat
            {overview.seatCount === 1 ? '' : 's'} in {overview.countryCode}.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            {sortedPlans.map((plan) => {
              const isCurrent = currentPlanSlug === plan.slug;
              const isPending = checkoutPlan === plan.slug && checkout.isPending;

              return (
                <div key={plan.planPriceId} className="app-card rounded-xl border p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{plan.name}</p>
                      {plan.description ? (
                        <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
                      ) : null}
                    </div>
                    {isCurrent ? <Badge variant="secondary">Current</Badge> : null}
                  </div>
                  <p className="text-2xl font-bold tracking-tight">
                    {formatMoney(plan.monthlyTotal, plan.currency)}
                    <span className="text-sm font-normal text-muted-foreground"> / month</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatMoney(plan.pricePerSeat, plan.currency)} per seat × {plan.seatCount}
                  </p>
                  {overview.canManageBilling ? (
                    <Button
                      className="mt-4 w-full"
                      size="sm"
                      disabled={isCurrent || isPending || overview.subscription?.status === 'ACTIVE'}
                      onClick={() => handleCheckout(plan.slug)}
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Redirecting…
                        </>
                      ) : isCurrent ? (
                        'Current plan'
                      ) : (
                        'Subscribe'
                      )}
                    </Button>
                  ) : (
                    <p className="mt-4 text-xs text-muted-foreground">
                      Only workspace owners and admins can start checkout.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {tenant?.member?.role && !overview.canManageBilling && overview.paymentsEnabled ? (
        <p className="text-xs text-muted-foreground">
          Your role ({tenant.member.role}) can view billing but cannot start checkout.
        </p>
      ) : null}
    </div>
  );
}
