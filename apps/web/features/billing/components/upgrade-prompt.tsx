'use client';

import { ArrowLeft } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import { AppPage } from '@/components/app-page';
import { LoadingBlock } from '@/components/loading-block';
import { Button } from '@/components/ui/button';
import { useBillingOverview } from '@/hooks/queries/use-billing';
import { useFeatureAccess } from '@/hooks/queries/use-feature-access';
import { ApiError } from '@/lib/api/client';
import type { FeatureAccess } from '@/lib/constants/feature-access';
import { getPlansForFeature } from '@/lib/constants/feature-tier-map';
import { isPlanSlug, PLAN_CATALOG } from '@/lib/constants/plan-catalog';
import { getFeatureForRoute } from '@/lib/constants/route-feature-map';
import { tenantPath } from '@/lib/navigation/tenant-routes';
import { cn } from '@/lib/utils';
import { useTenant } from '@/providers/tenant-provider';

type SearchParamsLike = {
  get(name: string): string | null;
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute('disabled') && element.getClientRects().length > 0,
  );
}

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

type UpgradeRequiredPanelProps = {
  feature: FeatureAccess | string;
  className?: string;
  dismissAction?: React.ReactNode;
  titleId?: string;
  descriptionId?: string;
};

export function UpgradeRequiredPanel({
  feature,
  className,
  dismissAction,
  titleId,
  descriptionId,
}: UpgradeRequiredPanelProps) {
  const { currentPlan, plansForFeature, sortedPlans, handleUpgrade } = useUpgradeOptions(feature);
  const fallbackPlan = plansForFeature[0];

  return (
    <section className={cn('dashboard-panel rounded-[8px] p-6 sm:p-8', className)}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <span className="inline-flex w-fit items-center rounded-full border border-[#d7e3f6] bg-[#eef4ff] px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              Upgrade required
            </span>
            <div className="space-y-2">
              <h2
                id={titleId}
                className="text-[28px] font-semibold tracking-[-0.03em] text-slate-950 dark:text-slate-100"
              >
                Upgrade to access this feature
              </h2>
              <p
                id={descriptionId}
                className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400"
              >
                This feature is not available on your current plan. Upgrade your workspace to unlock
                access.
              </p>
            </div>
          </div>
          {dismissAction}
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

function getUpgradeDismissHref(
  pathname: string,
  tenantSlug: string | undefined,
  searchParams: SearchParamsLike,
): string {
  if (!tenantSlug) {
    return '/';
  }

  const tab = searchParams.get('tab');

  if (pathname.includes('/settings') && tab) {
    return tenantPath(tenantSlug, 'settings');
  }

  if (pathname.includes('/shoutouts') && (tab === 'redeem' || tab === 'rewards')) {
    return tenantPath(tenantSlug, 'shoutouts');
  }

  return tenantPath(tenantSlug);
}

export function UpgradePrompt({
  children,
  featureOverride,
}: {
  children: React.ReactNode;
  featureOverride?: FeatureAccess | string | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const dismissButtonRef = useRef<HTMLButtonElement>(null);
  const blurredContentRef = useRef<HTMLDivElement>(null);
  const { tenant } = useTenant();
  const { hasFeature, featureGatingEnabled, isLoading: featureAccessLoading } = useFeatureAccess();
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();
  const feature = featureOverride ?? getFeatureForRoute(pathname, searchParams);
  const hasAccess = !feature || !featureGatingEnabled || hasFeature(feature as FeatureAccess);

  const dismissHref = useMemo(
    () => getUpgradeDismissHref(pathname, tenant?.slug, searchParams),
    [pathname, searchParams, tenant?.slug],
  );

  const handleDismiss = useCallback(() => {
    router.replace(dismissHref);
  }, [dismissHref, router]);

  useEffect(() => {
    if (hasAccess || !feature) {
      return;
    }

    const blurredContent = blurredContentRef.current;
    const dialog = dialogRef.current;

    if (!blurredContent || !dialog) {
      return;
    }

    const previousActiveElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousAriaHidden = blurredContent.getAttribute('aria-hidden');
    const previousInert = blurredContent.inert;

    blurredContent.inert = true;
    blurredContent.setAttribute('aria-hidden', 'true');

    const focusFirstElement = () => {
      const focusableElements = getFocusableElements(dialog);
      const nextFocusTarget = dismissButtonRef.current ?? focusableElements[0] ?? dialog;
      nextFocusTarget.focus();
    };

    const frame = window.requestAnimationFrame(focusFirstElement);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = getFocusableElements(dialog);
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;

      if (event.shiftKey) {
        if (activeElement === firstElement || activeElement === dialog) {
          event.preventDefault();
          lastElement.focus();
        }
        return;
      }

      if (activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof Node && dialog.contains(target)) {
        return;
      }

      focusFirstElement();
    };

    dialog.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);

    return () => {
      window.cancelAnimationFrame(frame);
      dialog.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);
      blurredContent.inert = previousInert;
      if (previousAriaHidden === null) {
        blurredContent.removeAttribute('aria-hidden');
      } else {
        blurredContent.setAttribute('aria-hidden', previousAriaHidden);
      }
      if (previousActiveElement?.isConnected) {
        previousActiveElement.focus();
      }
    };
  }, [feature, hasAccess]);

  if (feature && featureAccessLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <LoadingBlock />
      </div>
    );
  }

  if (hasAccess || !feature) {
    return <>{children}</>;
  }

  return (
    <div className="relative h-full min-h-full min-w-0 overflow-hidden">
      <div
        ref={blurredContentRef}
        className="pointer-events-none absolute inset-0 min-w-0 overflow-hidden blur-[6px] saturate-50 transition-[filter] duration-200"
      >
        {children}
      </div>
      <div className="absolute inset-0 z-30 overflow-hidden bg-background/55 backdrop-blur-sm">
        <div className="flex h-full items-center justify-center px-3 py-6 sm:px-4 md:py-10">
          <AppPage className="w-full max-w-5xl">
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={dialogTitleId}
              aria-describedby={dialogDescriptionId}
              tabIndex={-1}
            >
              <UpgradeRequiredPanel
                feature={feature}
                titleId={dialogTitleId}
                descriptionId={dialogDescriptionId}
                className="mx-auto w-full max-w-3xl"
                dismissAction={
                  <Button
                    ref={dismissButtonRef}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={handleDismiss}
                  >
                    <ArrowLeft className="size-4" />
                    Dismiss
                  </Button>
                }
              />
            </div>
          </AppPage>
        </div>
      </div>
    </div>
  );
}
