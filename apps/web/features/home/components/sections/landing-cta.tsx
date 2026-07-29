'use client';

import { motion, useInView } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlanPricingCard } from '@/features/billing/components/plan-pricing-card';
import { fetchLandingPricing } from '@/lib/api/subscriptions';
import { LANDING_PRICING_BY_CURRENCY, PLAN_CATALOG } from '@/lib/constants/plan-catalog';
import { fadeUp, stagger } from '../../constants/landing-motion';
import { createLandingPricingCurrencyController } from '../../lib/landing-pricing-currency';

export const LandingCta = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [currency, setCurrency] = useState('USD');

  useEffect(() => {
    const controller = createLandingPricingCurrencyController(setCurrency);

    void fetchLandingPricing()
      .then((result) => controller.applyResolvedCurrency(result))
      .catch(() => controller.applyFallbackCurrency());

    return () => {
      controller.cleanup();
    };
  }, []);

  const plans = useMemo(() => {
    const prices = LANDING_PRICING_BY_CURRENCY[currency] ?? LANDING_PRICING_BY_CURRENCY.USD;
    return prices.map((price) => ({
      ...price,
      ...PLAN_CATALOG[price.slug],
    }));
  }, [currency]);

  return (
    <section id="pricing" ref={ref} className="py-24 md:py-32">
      <motion.div
        className="mx-auto max-w-6xl px-6"
        initial="hidden"
        animate={inView ? 'show' : 'hidden'}
        variants={stagger}
      >
        <div className="rounded-3xl border border-border bg-muted/40 px-8 py-16 md:px-16 md:py-20">
          <motion.div variants={fadeUp} className="text-center">
            <p className="text-sm font-medium text-primary">Pricing</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
              Simple per-seat pricing
            </h2>
            <p className="mt-3 max-w-xl mx-auto text-sm text-muted-foreground">
              Payroll included on every plan. Pay per active employee — no payroll add-on required.
            </p>
          </motion.div>

          <motion.div variants={stagger} className="mt-10 grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <motion.div key={plan.slug} variants={fadeUp}>
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
              </motion.div>
            ))}
          </motion.div>

          <motion.div variants={fadeUp} className="mt-10 text-center">
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
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
};
