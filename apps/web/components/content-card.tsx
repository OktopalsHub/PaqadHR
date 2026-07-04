import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ContentCardProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  bodyClassName?: string;
};

export function ContentCard({
  title,
  description,
  action,
  children,
  className,
  headerClassName,
  titleClassName,
  descriptionClassName,
  bodyClassName,
}: ContentCardProps) {
  return (
    <section className={cn('app-card flex flex-col overflow-hidden rounded-[8px]', className)}>
      <div
        className={cn(
          'flex flex-col gap-2 border-b border-[#d7e3f6] px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700/80',
          headerClassName,
        )}
      >
        <div className="min-w-0">
          <h2
            className={cn(
              'text-[17px] font-semibold tracking-tight text-slate-950 dark:text-foreground',
              titleClassName,
            )}
          >
            {title}
          </h2>
          {description ? (
            <p
              className={cn(
                'text-sm text-slate-600 dark:text-muted-foreground',
                descriptionClassName,
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={cn('flex-1 p-5', bodyClassName)}>{children}</div>
    </section>
  );
}
