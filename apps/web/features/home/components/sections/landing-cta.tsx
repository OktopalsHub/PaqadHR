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
    <section id="pricing" ref={ref} className="landing-pricing-section py-24 md:py-32">
      <motion.div
        className="mx-auto max-w-7xl px-6 lg:px-8"
        initial="hidden"
        animate={inView ? 'show' : 'hidden'}
        variants={stagger}
      >
        <div className="overflow-hidden rounded-[2rem] border border-border bg-[#f4f8f6] px-6 py-12 sm:px-8 md:px-12 md:py-16">
          <motion.div
            variants={fadeUp}
            className="grid gap-5 md:grid-cols-[0.85fr_1.15fr] md:items-end"
          >
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
