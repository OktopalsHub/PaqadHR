'use client';

import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { getPlanCatalog } from '@/lib/constants/plan-catalog';
import { formatPlanMoney } from '@/lib/format-plan-money';
import { cn } from '@/lib/utils';

export interface PlanPricingCardProps {
  slug: string;
  name: string;
  description?: string | null;
  currency: string;
  pricePerSeat: number;
  seatCount?: number;
  monthlyTotal?: number;
  highlights?: string[];
  maxEmployees?: number;
  payrollFeePercent?: number;
  isPopular?: boolean;
  isCurrent?: boolean;
  action?: ReactNode;
  className?: string;
  variant?: 'app' | 'marketing' | 'onboarding';
}

export function PlanPricingCard({
  slug,
  name,
  description,
  currency,
  pricePerSeat,
  seatCount,
  monthlyTotal,
  highlights,
  maxEmployees,
  payrollFeePercent,
  isPopular,
  isCurrent,
  action,
  className,
  variant = 'app',
}: PlanPricingCardProps) {
  const catalog = getPlanCatalog(slug);
  const isOnboarding = variant === 'onboarding';
  const featureList = highlights ?? catalog?.highlights ?? [];
  const employeeLimit = maxEmployees ?? catalog?.maxEmployees;
  const payrollFee = payrollFeePercent ?? catalog?.payrollFeePercent;
  const tagline = catalog?.tagline;

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-xl border p-4 text-left',
        isPopular && 'border-primary/50 bg-primary/5 ring-1 ring-primary/20 shadow-sm',
        variant === 'marketing' && 'rounded-2xl p-5',
        variant === 'marketing' && isPopular && 'bg-primary/5',
        variant === 'marketing' && !isPopular && 'bg-card',
        variant === 'onboarding' &&
          'rounded-[22px] p-4 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.18)]',
        variant === 'onboarding' && isPopular && 'bg-primary/5',
        variant === 'onboarding' && !isPopular && 'bg-card/95',
        variant === 'app' && 'app-card transition-all hover:border-primary/50 hover:shadow-sm',
        className,
      )}
    >
      {isCurrent ? (
        <Badge
          variant="secondary"
          className={cn('absolute -top-2.5 right-4 text-[10px]', isOnboarding && 'text-[11px]')}
        >
          Current
        </Badge>
      ) : isPopular ? (
        <Badge
          className={cn('absolute -top-2.5 right-4 text-[10px]', isOnboarding && 'text-[11px]')}
        >
          Popular
        </Badge>
      ) : null}

      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className={cn('font-semibold', isOnboarding && 'text-[1.05rem] tracking-[-0.02em]')}>
            {name}
          </p>
          {tagline ? (
            <p
              className={cn(
                'mt-0.5 text-xs text-muted-foreground',
                isOnboarding && 'text-[11px] leading-4.5',
              )}
            >
              {tagline}
            </p>
          ) : null}
          {description ? (
            <p
              className={cn(
                'mt-1 text-xs text-muted-foreground',
                isOnboarding && 'text-[11px] leading-5',
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
      </div>

      <p
        className={cn(
          'text-2xl font-bold tracking-tight',
          isOnboarding && 'text-[2.05rem] leading-none',
        )}
      >
        {formatPlanMoney(pricePerSeat, currency)}
        <span
          className={cn('text-sm font-normal text-muted-foreground', isOnboarding && 'text-[12px]')}
        >
          {' '}
          / user / mo
        </span>
      </p>

      {seatCount != null && seatCount > 1 && monthlyTotal != null ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {formatPlanMoney(monthlyTotal, currency)} / mo for {seatCount} seats
        </p>
      ) : null}

      {employeeLimit != null || payrollFee != null ? (
        <div className={cn('mt-3 flex flex-wrap gap-2', isOnboarding && 'mt-2.5 gap-1.5')}>
          {employeeLimit != null ? (
            <Badge
              variant="outline"
              className={cn('text-[10px] font-normal', isOnboarding && 'px-2.5 py-1 text-[10px]')}
            >
              Up to {employeeLimit} employees
            </Badge>
          ) : null}
          {payrollFee != null ? (
            <Badge
              variant="outline"
              className={cn('text-[10px] font-normal', isOnboarding && 'px-2.5 py-1 text-[10px]')}
            >
              {payrollFee}% payroll platform fee
            </Badge>
          ) : null}
        </div>
      ) : null}

      {featureList.length > 0 ? (
        <ul
          className={cn(
            'mt-4 flex-1 space-y-2 border-t border-border/60 pt-4',
            isOnboarding && 'mt-3 space-y-1.5 pt-3',
          )}
        >
          {featureList.map((feature) => (
            <li
              key={feature}
              className={cn(
                'flex gap-2 text-xs text-muted-foreground',
                isOnboarding && 'text-[11px] leading-5',
              )}
            >
              <Check
                className={cn('mt-0.5 size-3.5 shrink-0 text-primary', isOnboarding && 'size-3')}
                aria-hidden
              />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
