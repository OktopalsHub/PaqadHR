'use client';

import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { fadeUp, stagger } from '../../constants/landing-motion';
import { LandingProductPreview } from './landing-product-preview';

export const LandingHero = () => {
  return (
    <section className="relative overflow-hidden pt-12 pb-8 md:pt-16 md:pb-12">
      <div className="landing-beam pointer-events-none absolute inset-0" />

      <motion.div
        className="relative mx-auto max-w-4xl px-6 text-center"
        initial="hidden"
        animate="show"
        variants={stagger}
      >
        <motion.div variants={fadeUp} className="flex justify-center">
          <Link
            href="#product"
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-primary/15"
          >
            New: Recruitment board with kanban
            <ChevronRight className="size-3.5" />
          </Link>
        </motion.div>

        <motion.h1
          variants={fadeUp}
          className="mt-6 text-4xl font-semibold tracking-[-0.03em] text-foreground md:text-5xl md:leading-[1.08] lg:text-[3.25rem]"
        >
          HR management that is easy and simple.
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg"
        >
          Simplify hiring, empower teams, and run people operations with one calm workspace —
          recruitment, payroll, leave, and recognition.
        </motion.p>

        <motion.div variants={fadeUp} className="mt-8 flex justify-center">
          <Button
            asChild
            size="lg"
            className="h-12 rounded-full bg-foreground px-8 text-sm font-semibold text-background hover:bg-foreground/90"
          >
            <Link href="/signup">Get started for free</Link>
          </Button>
        </motion.div>

        <motion.p variants={fadeUp} className="mt-4 text-sm text-muted-foreground">
          14 days free · No card required
        </motion.p>
      </motion.div>

      <LandingProductPreview />
    </section>
  );
};
