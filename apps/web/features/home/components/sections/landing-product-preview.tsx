'use client';

import { motion } from 'framer-motion';
import { scaleIn } from '@/features/home/constants/landing-motion';
import { cn } from '@/lib/utils';

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('rounded-md bg-muted/70', className)} />;
}

export function LandingProductPreview() {
  return (
    <motion.div
      className="relative mx-auto mt-12 max-w-6xl px-6 md:mt-16"
      initial="hidden"
      animate="show"
      variants={scaleIn}
    >
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xl shadow-black/10">
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="size-2 rounded-full bg-red-400/80" />
            <span className="size-2 rounded-full bg-amber-400/80" />
            <span className="size-2 rounded-full bg-emerald-400/80" />
          </div>
          <Skeleton className="h-3 w-28" />
        </div>

        <div className="flex min-h-[420px] lg:min-h-[480px]">
          <div className="hidden w-52 shrink-0 border-r border-border/60 p-4 lg:block">
            <Skeleton className="mb-4 h-4 w-24" />
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-8 w-full" />
              ))}
            </div>
          </div>

          <div className="min-w-0 flex-1 p-4 md:p-5">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-9 w-56" />
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, column) => (
                <div key={column} className="rounded-xl border border-border/50 bg-muted/20 p-3">
                  <Skeleton className="mb-3 h-4 w-20" />
                  <div className="space-y-2">
                    {Array.from({ length: column % 2 === 0 ? 3 : 2 }).map((_, card) => (
                      <Skeleton key={card} className="h-16 w-full rounded-lg" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
