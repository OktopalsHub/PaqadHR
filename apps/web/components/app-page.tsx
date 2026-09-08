import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type AppPageProps = {
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<'div'>, 'children' | 'className'>;

export function AppPage({ children, className, ...props }: AppPageProps) {
  return (
    <div className={cn('min-w-0 w-full max-w-none space-y-5', className)} {...props}>
      {children}
    </div>
  );
}
