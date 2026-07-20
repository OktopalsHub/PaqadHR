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
  variant?: 'app' | 'marketing';
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
        variant === 'app' && 'app-card transition-all hover:border-primary/50 hover:shadow-sm',
        className,
      )}
    >
      {isCurrent ? (
        <Badge variant="secondary" className="absolute -top-2.5 right-4 text-[10px]">
          Current
        </Badge>
      ) : isPopular ? (
        <Badge className="absolute -top-2.5 right-4 text-[10px]">Popular</Badge>
      ) : null}

      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{name}</p>
          {tagline ? <p className="mt-0.5 text-xs text-muted-foreground">{tagline}</p> : null}
          {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
        </div>
      </div>

      <p className="text-2xl font-bold tracking-tight">
        {formatPlanMoney(pricePerSeat, currency)}
        <span className="text-sm font-normal text-muted-foreground"> / user / mo</span>
      </p>

      {seatCount != null && seatCount > 1 && monthlyTotal != null ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {formatPlanMoney(monthlyTotal, currency)} / mo for {seatCount} seats
        </p>
      ) : null}

      {employeeLimit != null || payrollFee != null ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {employeeLimit != null ? (
            <Badge variant="outline" className="text-[10px] font-normal">
              Up to {employeeLimit} employees
            </Badge>
          ) : null}
          {payrollFee != null ? (
            <Badge variant="outline" className="text-[10px] font-normal">
              {payrollFee}% payroll platform fee
            </Badge>
          ) : null}
        </div>
      ) : null}

      {featureList.length > 0 ? (
        <ul className="mt-4 flex-1 space-y-2 border-t border-border/60 pt-4">
          {featureList.map((feature) => (
            <li key={feature} className="flex gap-2 text-xs text-muted-foreground">
              <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
