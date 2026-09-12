'use client';

import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Check, Sparkles } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { fadeUp, stagger } from '../../constants/landing-motion';

const ProductDemoShell = dynamic(
  () => import('../product-demo/product-demo-shell').then((mod) => mod.ProductDemoShell),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto mt-12 h-[420px] max-w-6xl animate-pulse rounded-2xl bg-muted/40 px-6 md:mt-16" />
    ),
  },
);

export const LandingHero = () => {
  return (
    <section className="landing-hero-shell relative overflow-hidden pb-10 pt-8 md:pb-14 md:pt-12">
      <div className="landing-hero-grid pointer-events-none absolute inset-0" />
      <div className="landing-hero-orb pointer-events-none absolute -right-40 -top-32 size-[34rem] rounded-full" />

      <motion.div
        className="relative mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-end lg:gap-8 lg:px-8"
        initial="hidden"
        animate="show"
        variants={stagger}
      >
        <div className="max-w-2xl pt-3 lg:pb-8">
          <motion.div
            variants={fadeUp}
            className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/75 py-1.5 pl-2 pr-3 text-xs font-semibold text-foreground shadow-sm backdrop-blur"
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Sparkles className="size-3" />
            </span>
            The calm way to run a growing team
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="mt-7 max-w-xl text-[2.75rem] font-semibold leading-[0.98] tracking-[-0.06em] text-foreground sm:text-6xl lg:text-[4.7rem]"
          >
            People work is
            <span className="block text-primary">real work.</span>
            Treat it that way.
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-7 max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg"
          >
            Paqad gives your team one considered place to hire, pay, plan time off, and make good
            work visible.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-[0_10px_26px_-12px_var(--brand)] hover:bg-primary/90"
            >
              <Link href="/signup">
                Start your workspace <ArrowUpRight className="size-4" />
              </Link>
            </Button>
            <a
              href="#product"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-border bg-card/70 px-5 text-sm font-semibold text-foreground transition-colors hover:border-primary/35 hover:bg-card"
            >
              See the workspace <ArrowDownRight className="size-4 text-primary" />
            </a>
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"
          >
            {['14 days free', 'No card required', 'Set up in an afternoon'].map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-primary" /> {item}
              </span>
            ))}
          </motion.div>
        </div>

        <motion.div variants={fadeUp} className="relative mx-auto w-full max-w-md lg:mx-0 lg:mb-1">
          <div className="landing-note-card landing-note-card-top absolute -left-4 -top-4 z-10 hidden w-52 rounded-2xl p-4 shadow-lg lg:block">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              This week <span className="text-primary">On track</span>
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-[-0.05em]">37</p>
            <p className="mt-0.5 text-xs text-muted-foreground">hours returned to the team</p>
          </div>
          <div className="landing-note-card landing-note-card-bottom absolute -bottom-5 -right-3 z-10 hidden w-56 rounded-2xl p-4 shadow-lg lg:block">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-primary" />
              <span className="text-xs font-semibold">Payroll is ready</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Everyone has been reviewed. One last approval and it is done.
            </p>
          </div>
          <div className="relative overflow-hidden rounded-[1.75rem] border border-border bg-card p-2 shadow-[0_24px_70px_-36px_rgba(13,31,24,0.45)]">
            <div className="flex items-center justify-between rounded-2xl bg-[#173c32] px-4 py-3 text-[11px] text-white/75">
              <span className="font-semibold tracking-[0.14em] text-white/90 uppercase">
                Today at Paqad
              </span>
              <span>Wed, 10:24</span>
            </div>
            <div className="grid gap-2 p-3 sm:grid-cols-[1.08fr_0.92fr]">
              <div className="rounded-xl bg-[#f3f7f5] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  People pulse
                </p>
                <p className="mt-4 text-3xl font-semibold tracking-[-0.06em]">92%</p>
                <p className="mt-1 text-xs text-muted-foreground">team check-ins complete</p>
                <div className="mt-5 flex h-1.5 gap-1 overflow-hidden rounded-full">
                  <span className="w-[62%] rounded-full bg-primary" />
                  <span className="w-[24%] rounded-full bg-[#91cdbb]" />
                  <span className="flex-1 rounded-full bg-[#d9e4df]" />
                </div>
              </div>
              <div className="space-y-2">
                {['Leave cover confirmed', '3 offers moving forward', '8 shoutouts shared'].map(
                  (item, index) => (
                    <div
                      key={item}
                      className="flex items-center gap-2 rounded-xl border border-border/70 p-2.5"
                    >
                      <span
                        className={`size-2 rounded-full ${index === 1 ? 'bg-[#e5aa50]' : 'bg-primary'}`}
                      />
                      <span className="text-[11px] font-medium leading-tight text-foreground">
                        {item}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <div className="relative mx-auto mt-14 max-w-7xl px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            A single desk for your people
          </p>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Payroll · Hiring · Time off · Recognition
          </p>
        </div>
        <ProductDemoShell className="landing-product-frame" />
      </div>
    </section>
  );
};
