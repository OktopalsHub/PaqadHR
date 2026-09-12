import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex min-h-[260px] w-full flex-col items-center justify-center px-4 py-12 text-center sm:px-6 sm:py-16',
        className,
      )}
    >
      <div className="relative mb-5 flex size-14 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-600 shadow-sm dark:border-emerald-900/70 dark:bg-emerald-950/35 dark:text-emerald-300">
        <span className="absolute -right-2 top-3 h-px w-4 bg-emerald-200 dark:bg-emerald-800" />
        <span className="absolute -bottom-2 left-2 h-px w-4 bg-emerald-200 dark:bg-emerald-800" />
        <Icon className="size-5" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6 w-full sm:w-auto *:w-full sm:*:w-auto">{action}</div> : null}
    </div>
  );
}
