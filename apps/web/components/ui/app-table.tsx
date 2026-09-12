'use client';

import { Inbox, type LucideIcon } from 'lucide-react';
import type * as React from 'react';
import { EmptyState } from '@/components/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

function AppTablePanel({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-col overflow-hidden rounded-[8px] bg-white shadow-sm [&>[data-slot=table-container]]:flex-1 dark:bg-card',
        className,
      )}
      {...props}
    />
  );
}

function AppTable({ className, ...props }: React.ComponentProps<typeof Table>) {
  return (
    <Table className={cn('min-w-[980px] w-full bg-white dark:bg-card', className)} {...props} />
  );
}

function AppTableHeaderSection({ className, ...props }: React.ComponentProps<typeof TableHeader>) {
  return <TableHeader className={className} {...props} />;
}

function AppTableHeaderRow({ className, ...props }: React.ComponentProps<typeof TableRow>) {
  return (
    <TableRow
      className={cn(
        'border-b border-border/60 bg-[#e8f5ed] hover:bg-[#e8f5ed] dark:bg-emerald-950/30 dark:hover:bg-emerald-950/30',
        className,
      )}
      {...props}
    />
  );
}

function AppTableBodySection({ className, ...props }: React.ComponentProps<typeof TableBody>) {
  return <TableBody className={className} {...props} />;
}

type AppTableBodyRowProps = React.ComponentProps<typeof TableRow> & {
  divider?: boolean;
};

function AppTableBodyRow({ className, divider = true, ...props }: AppTableBodyRowProps) {
  return (
    <TableRow
      className={cn(
        divider &&
          '!border-b !border-slate-200 transition-colors hover:bg-emerald-50/30 dark:!border-slate-800 dark:hover:bg-emerald-950/15',
        className,
      )}
      {...props}
    />
  );
}

function AppTableHeadCell({ className, ...props }: React.ComponentProps<typeof TableHead>) {
  return (
    <TableHead
      className={cn(
        'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground/80 sm:px-6',
        className,
      )}
      {...props}
    />
  );
}

function AppTableCell({ className, ...props }: React.ComponentProps<typeof TableCell>) {
  return (
    <TableCell className={cn('px-4 py-3 text-sm text-foreground sm:px-6', className)} {...props} />
  );
}

type AppTableEmptyStateProps = {
  colSpan: number;
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
};

function AppTableEmptyState({
  colSpan,
  title = 'Nothing here yet',
  description,
  icon = Inbox,
  action,
  className,
}: AppTableEmptyStateProps) {
  return (
    <AppTableBodyRow divider={false} className="hover:bg-transparent">
      <AppTableCell colSpan={colSpan} className="p-0">
        <EmptyState
          icon={icon}
          title={title}
          description={description}
          action={action}
          className={cn('min-h-[280px] rounded-none bg-transparent', className)}
        />
      </AppTableCell>
    </AppTableBodyRow>
  );
}

function AppTableFooterBar({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'mt-auto flex flex-col items-start gap-3 border-t border-border/60 bg-white px-4 py-4 dark:bg-card sm:flex-row sm:items-center sm:justify-between sm:px-6',
        className,
      )}
      {...props}
    />
  );
}

export {
  AppTable,
  AppTableBodyRow,
  AppTableBodySection,
  AppTableCell,
  AppTableEmptyState,
  AppTableFooterBar,
  AppTableHeadCell,
  AppTableHeaderRow,
  AppTableHeaderSection,
  AppTablePanel,
};
