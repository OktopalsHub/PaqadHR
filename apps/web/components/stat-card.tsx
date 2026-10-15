import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  iconClassName?: string;
  trend?: { value: string; positive?: boolean };
  className?: string;
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  iconClassName,
  trend,
  className,
}: StatCardProps) {
  return (
    <article
      className={cn(
        'app-card group rounded-[8px] p-5 transition-colors hover:border-primary/20',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#516079] dark:text-muted-foreground">
          {label}
        </p>
        <div
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#e1ebff] text-[#35598e] shadow-sm dark:bg-slate-800 dark:text-blue-300',
            iconClassName,
          )}
        >
          <Icon className="size-[18px]" />
        </div>
      </div>
      <p className="mt-3 text-[31px] font-semibold leading-none tracking-[-0.035em] text-slate-950 dark:text-foreground">
        {value}
      </p>
      {trend ? (
        <p
          className={cn(
            'mt-2 text-sm font-medium',
            trend.positive ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          {trend.value}
        </p>
      ) : hint ? (
        <p className="mt-2 text-sm text-slate-600 dark:text-muted-foreground">{hint}</p>
      ) : null}
    </article>
  );
}
