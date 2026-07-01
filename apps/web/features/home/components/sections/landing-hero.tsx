'use client';

import { motion } from 'framer-motion';
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
    <section className="relative overflow-hidden pt-12 pb-8 md:pt-16 md:pb-12">
      <div className="landing-beam pointer-events-none absolute inset-0" />

      <motion.div
        className="relative mx-auto max-w-4xl px-6 text-center"
        initial="hidden"
        animate="show"
        variants={stagger}
      >
        {}

        <motion.h1
          variants={fadeUp}
          className="mt-6 text-4xl font-semibold tracking-[-0.03em] text-foreground md:text-5xl md:leading-[1.08] lg:text-[3.25rem]"
        >
          HR and payroll built for modern teams.
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg"
        >
          Hire, pay, and recognize your people in one workspace without spreadsheet chaos.
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

      <ProductDemoShell className="relative mx-auto mt-12 max-w-6xl px-6 md:mt-16" />
    </section>
  );
};
