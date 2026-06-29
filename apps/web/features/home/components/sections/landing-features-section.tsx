'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { services } from '../../constants/landing-content';
import { fadeUp, stagger } from '../../constants/landing-motion';

export const LandingFeaturesSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section id="features" ref={ref} className="border-t border-border py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial="hidden"
          animate={inView ? 'show' : 'hidden'}
          variants={stagger}
          className="mb-16"
        >
          <motion.p
            variants={fadeUp}
            className="text-xs font-semibold uppercase tracking-widest text-primary"
          >
            Features
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="mt-3 text-3xl font-semibold tracking-[-0.02em] md:text-4xl"
          >
            Engineered for high performance
          </motion.h2>
          <motion.p variants={fadeUp} className="mt-4 text-sm text-muted-foreground max-w-xl">
            A calm, compliant operations system loaded with micro-utilities to save hours of manual
            payroll sheets, job site management, and holiday requests.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          animate={inView ? 'show' : 'hidden'}
          variants={stagger}
          className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3"
        >
          {services.map((item) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                variants={fadeUp}
                className="group relative bg-card p-7 transition-colors hover:bg-black/[0.01]"
              >
                <div className="mb-4 flex size-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary transition-all group-hover:border-primary/40 group-hover:bg-primary/15 group-hover:shadow-[0_0_16px_rgba(255,204,0,0.2)]">
                  <Icon className="size-[18px]" />
                </div>
                <h3 className="mb-1 text-sm font-semibold text-foreground">{item.title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{item.description}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};
