'use client';

import { motion, useInView } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { landingPricingByCurrency } from '../../constants/landing-demo-data';
import { fadeUp, stagger } from '../../constants/landing-motion';

const currencyLocales: Record<string, string> = {
  NGN: 'en-NG',
  USD: 'en-US',
};

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(currencyLocales[currency] ?? 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

function resolveLandingCurrency(): string {
  if (typeof window === 'undefined') return 'USD';
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === 'Africa/Lagos') return 'NGN';
  } catch {}
  return 'USD';
}

export const LandingCta = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [currency, setCurrency] = useState('USD');
  const plans = landingPricingByCurrency[currency] ?? landingPricingByCurrency.USD;

  useEffect(() => {
    setCurrency(resolveLandingCurrency());
  }, []);

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
            <p className="mt-3 text-xs text-muted-foreground">Prices shown in {currency}</p>
          </motion.div>

          <motion.div variants={stagger} className="mt-10 grid gap-4 md:grid-cols-3">
            {plans.map((plan) => {
              const isPopular = plan.slug === 'growth';
              return (
                <motion.div
                  key={plan.slug}
                  variants={fadeUp}
                  className={`relative rounded-2xl border bg-card p-5 text-left ${
                    isPopular ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border/70'
                  }`}
                >
                  {isPopular ? (
                    <Badge className="absolute -top-2.5 right-4 text-[10px]">Popular</Badge>
                  ) : null}
                  <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {formatMoney(plan.pricePerSeat, plan.currency)}
                    <span className="text-sm font-normal text-muted-foreground"> / seat / mo</span>
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                </motion.div>
              );
            })}
          </motion.div>

          <motion.div variants={fadeUp} className="mt-10 text-center">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Link href="/signup">Create an account for free</Link>
            </Button>
            <p className="mt-4 text-sm text-muted-foreground">14 days free · No card required</p>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
};
