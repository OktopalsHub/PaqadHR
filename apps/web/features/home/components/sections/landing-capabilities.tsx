'use client';

import { motion, useInView } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';
import { fadeUp, stagger } from '../../constants/landing-motion';

const capabilities = [
  {
    title: 'Recruitment',
    line: 'Publish roles. Track every candidate.',
    href: '/signup',
  },
  {
    title: 'Payroll',
    line: 'Calculate runs. Export. Mark paid.',
    href: '/signup',
  },
  {
    title: 'Leave',
    line: 'Requests and balances, kept current.',
    href: '/signup',
  },
];

export const LandingCapabilities = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section id="product" ref={ref} className="border-t border-border py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial="hidden"
          animate={inView ? 'show' : 'hidden'}
          variants={stagger}
          className="mb-16 max-w-xl"
        >
          <motion.p variants={fadeUp} className="text-sm font-medium text-muted-foreground">
            Product
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="mt-3 text-3xl font-semibold tracking-[-0.02em] md:text-4xl"
          >
            Everything your team needs to run HR.
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          animate={inView ? 'show' : 'hidden'}
          variants={stagger}
          className="divide-y divide-border border-y border-border"
        >
          {capabilities.map((item) => (
            <motion.div
              key={item.title}
              variants={fadeUp}
              className="group grid gap-4 py-10 md:grid-cols-[200px_1fr_auto] md:items-center md:gap-8"
            >
              <p className="text-sm font-semibold text-foreground">{item.title}</p>
              <p className="text-sm text-muted-foreground">{item.line}</p>
              <Link
                href={item.href}
                className="inline-flex items-center gap-1 text-sm font-medium text-foreground transition-colors group-hover:text-primary"
              >
                Get started
                <ChevronRight className="size-4 text-primary" />
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
