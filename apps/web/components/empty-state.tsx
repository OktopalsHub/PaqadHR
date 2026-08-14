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
        'flex flex-col items-center justify-center rounded-[8px] border border-dashed border-slate-200 bg-slate-50/35 px-4 py-12 text-center sm:px-6 sm:py-16 dark:border-slate-800 dark:bg-slate-950/30',
        className,
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-full border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
        <Icon className="size-5 text-slate-500 dark:text-slate-300" />
      </div>
      <h3 className="text-base font-medium text-slate-900 dark:text-slate-100">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>
      ) : null}
      {action ? <div className="mt-6 w-full sm:w-auto *:w-full sm:*:w-auto">{action}</div> : null}
    </div>
  );
}
