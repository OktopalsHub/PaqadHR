'use client';

import { motion, useInView } from 'framer-motion';
import Link from 'next/link';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { fadeUp, stagger } from '../../constants/landing-motion';

export const LandingCta = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <section id="pricing" ref={ref} className="py-24 md:py-32">
      <motion.div
        className="mx-auto max-w-6xl px-6"
        initial="hidden"
        animate={inView ? 'show' : 'hidden'}
        variants={stagger}
      >
        <div className="rounded-3xl border border-border bg-muted/40 px-8 py-16 text-center md:px-16 md:py-20">
          <motion.h2
            variants={fadeUp}
            className="text-3xl font-semibold tracking-[-0.02em] md:text-4xl"
          >
            Ready when you are.
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mx-auto mt-4 max-w-md text-base text-muted-foreground"
          >
            Start your workspace in minutes. Try Paqad free for 14 days.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-8">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Link href="/signup">Create an account for free</Link>
            </Button>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
};
