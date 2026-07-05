import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ContentCardProps = {
  title?: string;
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
    <section
      className={cn('app-card min-w-0 flex flex-col overflow-hidden rounded-[8px]', className)}
    >
      <div
        className={cn(
          'flex flex-col gap-3 border-b border-[#d7e3f6] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-slate-700/80',
          headerClassName,
        )}
      >
        {title || description ? (
          <div className="min-w-0">
            {title ? (
              <h2
                className={cn(
                  'text-[17px] font-semibold tracking-tight text-slate-950 dark:text-foreground',
                  titleClassName,
                )}
              >
                {title}
              </h2>
            ) : null}
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
        ) : null}
        {action ? (
          <div className={cn(title || description ? 'w-full shrink-0 sm:w-auto' : 'w-full')}>
            {action}
          </div>
        ) : null}
      </div>
      <div className={cn('flex-1 p-4 sm:p-5', bodyClassName)}>{children}</div>
    </section>
  );
}
