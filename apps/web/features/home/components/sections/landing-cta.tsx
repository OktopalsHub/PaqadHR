'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlanPricingCard } from '@/features/billing/components/plan-pricing-card';
import { LANDING_PRICING_BY_CURRENCY, PLAN_CATALOG } from '@/lib/constants/plan-catalog';
import { createLandingPricingCurrencyController } from '../../lib/landing-pricing-currency';
import { useLandingReveal } from '../../lib/use-landing-reveal';

export const LandingCta = () => {
  const { ref, visible } = useLandingReveal<HTMLElement>('-60px');
  const [currency, setCurrency] = useState('USD');

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    const controller = createLandingPricingCurrencyController(setCurrency);

    // Keep axios and the API client out of the landing page's initial bundle;
    // this only runs once the pricing section is near the viewport.
    void import('@/lib/api/subscriptions')
      .then(({ fetchLandingPricing }) => fetchLandingPricing())
      .then((result) => {
        if (!cancelled) controller.applyResolvedCurrency(result);
      })
      .catch(() => {
        if (!cancelled) controller.applyFallbackCurrency();
      });

    return () => {
      cancelled = true;
      controller.cleanup();
    };
  }, [visible]);

  const plans = useMemo(() => {
    const prices = LANDING_PRICING_BY_CURRENCY[currency] ?? LANDING_PRICING_BY_CURRENCY.USD;
    return prices.map((price) => ({
      ...price,
      ...PLAN_CATALOG[price.slug],
    }));
  }, [currency]);

  return (
    <section
      id="pricing"
      ref={ref}
      className={`landing-pricing-section landing-reveal landing-deferred-paint py-24 md:py-32 ${
        visible ? 'is-visible' : ''
      }`}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="overflow-hidden rounded-[2rem] border border-border bg-[#f4f8f6] px-6 py-12 sm:px-8 md:px-12 md:py-16">
          <div className="landing-reveal-item grid gap-5 md:grid-cols-[0.85fr_1.15fr] md:items-end">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Pricing that scales gently
            </p>
            <div>
              <h2 className="text-3xl font-semibold tracking-[-0.045em] md:text-5xl md:leading-[1.03]">
                The whole desk, without the enterprise theatre.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
                Payroll comes with every plan. Pay for active teammates, not a pile of disconnected
                add-ons.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {plans.map((plan, index) => (
              <div
                key={plan.slug}
                className="landing-reveal-item"
                style={{ transitionDelay: `${index * 70}ms` }}
              >
                <PlanPricingCard
                  slug={plan.slug}
                  name={plan.name}
                  description={plan.description}
                  currency={plan.currency}
                  pricePerSeat={plan.pricePerSeat}
                  maxEmployees={plan.maxEmployees}
                  payrollFeePercent={plan.payrollFeePercent}
                  highlights={plan.highlights}
                  isPopular={plan.slug === 'growth'}
                  variant="marketing"
                />
              </div>
            ))}
          </div>

          <div className="landing-reveal-item mt-10 text-center">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Link href="/signup">Create an account for free</Link>
            </Button>
            <p className="mt-4 text-sm text-muted-foreground">
              14 days free · No card required · Manual payroll & bank export free on all plans
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
