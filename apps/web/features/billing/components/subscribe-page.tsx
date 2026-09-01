'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Building2, ChevronDown, CreditCard, Loader2, Sparkles } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AppPage } from '@/components/app-page';
import { LoadingBlock } from '@/components/loading-block';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PlanPricingCard } from '@/features/billing/components/plan-pricing-card';
import {
  useBillingOverview,
  useCreateSubscriptionCheckout,
  useStartTrial,
} from '@/hooks/queries/use-billing';
import { sortPlansByTier } from '@/lib/constants/plan-catalog';
import { formatWorkspaceName } from '@/lib/format-name';
import {
  goToTenantPath,
  subscribePageUrl,
  tenantPath,
  tenantRoot,
} from '@/lib/navigation/tenant-routes';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';

type SubscribePageProps = {
  variant?: 'app' | 'marketing';
};

export function SubscribePage({ variant = 'app' }: SubscribePageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { tenant, tenants, setTenantId } = useTenant();
  const { data: overview, isLoading, isError, error, refetch } = useBillingOverview();
  const checkout = useCreateSubscriptionCheckout();
  const startTrial = useStartTrial();
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState('growth');
  const isWelcome = searchParams.get('welcome') === '1';
  const isMarketing = variant === 'marketing';

  const billingParam = searchParams.get('billing');
  useEffect(() => {
    if (billingParam === 'success') {
      toast.success('Payment received. Welcome back!');
    }
  }, [billingParam]);

  useEffect(() => {
    if (overview?.subscription?.plan) {
      setSelectedPlan(overview.subscription.plan);
    }
  }, [overview?.subscription?.plan]);

  const sortedPlans = useMemo(() => sortPlansByTier(overview?.plans ?? []), [overview?.plans]);

  const switchableTenants = useMemo(
    () => tenants.filter((t) => t.id !== tenant?.id),
    [tenants, tenant?.id],
  );

  const dashboardHref = useMemo(() => {
    if (!tenants.length) return null;
    const target =
      tenants.find((t) => t.id !== tenant?.id) ?? tenants.find((t) => t.isActive) ?? tenants[0];
    if (!target?.slug) return null;
    try {
      return tenantRoot(target.slug);
    } catch {
      return `/${target.slug}`;
    }
  }, [tenants, tenant?.id]);

  const SwitchBanner = useMemo(() => {
    if (switchableTenants.length === 0) return null;
    return (
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-2 text-xs sm:text-sm">
        <Building2 className="size-4 text-muted-foreground" />
        <span className="text-muted-foreground">
          Not ready for{' '}
          <span className="font-medium text-foreground">{formatWorkspaceName(tenant?.name)}</span>?
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 rounded-full px-3 text-xs font-semibold"
            >
              Switch workspace <ChevronDown className="ml-1 size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-64 rounded-xl">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Your workspaces
            </DropdownMenuLabel>
            {tenants.map((item) => (
              <DropdownMenuItem
                key={item.id}
                onClick={() => setTenantId(item.id)}
                className="gap-2"
              >
                <span className="min-w-0 flex-1 truncate font-medium">
                  {formatWorkspaceName(item.name)}
                </span>
                {item.id === tenant?.id ? (
                  <span className="text-xs text-primary">Current</span>
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {dashboardHref ? (
          <span className="hidden items-center gap-2 sm:flex">
            <span className="text-muted-foreground">·</span>
            <a href={dashboardHref} className="font-medium text-primary hover:underline">
              Go to dashboard
            </a>
          </span>
        ) : null}
      </div>
    );
  }, [switchableTenants.length, tenants, tenant?.id, tenant?.name, dashboardHref, setTenantId]);

  const pageShell = useCallback(
    (content: ReactNode) =>
      isMarketing ? <div className="space-y-8">{content}</div> : <AppPage>{content}</AppPage>,
    [isMarketing],
  );

  const handleCheckout = async (planSlug: string) => {
    setCheckoutPlan(planSlug);
    try {
      const successUrl = tenant?.slug
        ? subscribePageUrl({ billing: true, workspace: tenant.slug })
        : subscribePageUrl({ billing: true });
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

  const handleStartTrial = async () => {
    try {
      await startTrial.mutateAsync(selectedPlan);
      if (tenant?.id) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.billing.status(tenant.id) });
        await queryClient.invalidateQueries({ queryKey: queryKeys.billing.overview(tenant.id) });
      }
      await refetch();
      toast.success('Your 14-day free trial has started');
      if (tenant?.slug) {
        goToTenantPath(tenant.slug, router.replace);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start trial');
    }
  };

  if (isLoading) {
    return isMarketing ? (
      <LoadingBlock />
    ) : (
      <AppPage>
        <LoadingBlock />
      </AppPage>
    );
  }

  if (isError || !overview) {
    const errorBlock = (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : 'Unable to load plans'}
      </p>
    );
    return isMarketing ? errorBlock : <AppPage>{errorBlock}</AppPage>;
  }

  const showTrialWelcome = isWelcome || !overview.subscription;
  const isOnTrial = overview.subscription?.isOnTrial && overview.entitled && !overview.needsPayment;
  const canStartTrial = overview.trialEligible !== false;

  if (showTrialWelcome) {
    return pageShell(
      <div className="w-full space-y-8 py-4">
        {SwitchBanner}
        <div className="space-y-2 text-center">
          {isMarketing ? (
            <p className="text-sm font-medium text-primary">Pricing</p>
          ) : (
            <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </div>
          )}
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {isOnTrial
              ? 'Your workspace trial is active'
              : canStartTrial
                ? 'Choose a plan to start your trial'
                : 'Choose a plan to continue'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isOnTrial
              ? `You have ${overview.subscription?.daysRemaining ?? 14} days left on your free trial. Pick a plan or continue to your workspace.`
              : canStartTrial
                ? 'Start with 14 days free on any plan. No card required.'
                : 'Your free trial was used on another workspace. Subscribe to activate this workspace.'}
          </p>
        </div>

        {sortedPlans.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-3">
            {sortedPlans.map((plan) => {
              const perSeat = plan.breakdown.basePrice / Math.max(1, plan.seatCount);
              const isSelected = selectedPlan === plan.slug;

              return (
                <button
                  key={plan.planPriceId}
                  type="button"
                  className="cursor-pointer text-left"
                  onClick={() => setSelectedPlan(plan.slug)}
                >
                  <PlanPricingCard
                    slug={plan.slug}
                    name={plan.name}
                    description={plan.description}
                    currency={plan.currency}
                    pricePerSeat={perSeat}
                    seatCount={plan.seatCount}
                    monthlyTotal={plan.monthlyTotal}
                    maxEmployees={plan.limits.maxEmployees}
                    isPopular={plan.slug === 'growth'}
                    variant={isMarketing ? 'marketing' : 'app'}
                    className={isSelected ? 'ring-2 ring-primary' : undefined}
                  />
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">No plans available.</p>
        )}

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          {overview.canManageBilling && canStartTrial ? (
            <Button
              size="lg"
              className="min-w-[220px]"
              disabled={startTrial.isPending || !selectedPlan}
              onClick={() => void handleStartTrial()}
            >
              {startTrial.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Starting trial…
                </>
              ) : isOnTrial ? (
                'Update trial plan'
              ) : (
                'Start 14-day free trial'
              )}
            </Button>
          ) : null}
          {overview.canManageBilling && !canStartTrial && !isOnTrial ? (
            <Button
              size="lg"
              className="min-w-[220px]"
              disabled={checkout.isPending || !selectedPlan}
              onClick={() => void handleCheckout(selectedPlan)}
            >
              {checkout.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Redirecting…
                </>
              ) : (
                'Subscribe'
              )}
            </Button>
          ) : null}
          {isOnTrial && tenant?.slug ? (
            <Button
              size="lg"
              variant="outline"
              className="min-w-[220px]"
              onClick={() => tenant?.slug && goToTenantPath(tenant.slug, router.replace)}
            >
              Continue to workspace
            </Button>
          ) : null}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {canStartTrial || isOnTrial
            ? 'Payroll and automated batch payouts are included on every plan during your trial.'
            : 'Payroll included on every plan · Manual pay & bank export are free'}
        </p>
        {dashboardHref ? (
          <div className="flex justify-center pt-2">
            <a href={dashboardHref} className="text-sm font-medium text-primary hover:underline">
              ← Back to dashboard
            </a>
          </div>
        ) : null}
      </div>,
    );
  }

  if (overview.entitled && !overview.needsPayment) {
    return pageShell(
      <div className="mx-auto max-w-lg space-y-4 py-12 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">You&apos;re all set</h1>
        <p className="text-sm text-muted-foreground">
          Your workspace subscription is active. Head back to the dashboard.
        </p>
        {tenant?.slug ? (
          <Button asChild>
            <a href={tenantPath(tenant.slug)}>Go to workspace</a>
          </Button>
        ) : null}
      </div>,
    );
  }

  return pageShell(
    <div className="w-full space-y-8 py-4">
      {SwitchBanner}
      <div className="space-y-2 text-center">
        {isMarketing ? <p className="text-sm font-medium text-primary">Pricing</p> : null}
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Choose a plan to continue
        </h1>
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
                variant={isMarketing ? 'marketing' : 'app'}
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
      {dashboardHref ? (
        <div className="flex justify-center pt-2">
          <a href={dashboardHref} className="text-sm font-medium text-primary hover:underline">
            ← Back to dashboard
          </a>
        </div>
      ) : null}
    </div>,
  );
}
