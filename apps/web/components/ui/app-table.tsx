'use client';

import type * as React from 'react';
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
        'min-w-0 overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/70 dark:shadow-none',
        className,
      )}
      {...props}
    />
  );
}

function AppTable({ className, ...props }: React.ComponentProps<typeof Table>) {
  return <Table className={cn('min-w-[980px]', className)} {...props} />;
}

function AppTableHeaderSection({ className, ...props }: React.ComponentProps<typeof TableHeader>) {
  return <TableHeader className={className} {...props} />;
}

function AppTableHeaderRow({ className, ...props }: React.ComponentProps<typeof TableRow>) {
  return (
    <TableRow
      className={cn(
        'border-b border-slate-200 bg-slate-50 hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-900/70',
        className,
      )}
      {...props}
    />
  );
}

function AppTableBodySection({ className, ...props }: React.ComponentProps<typeof TableBody>) {
  return (
    <TableBody
      className={cn('divide-y divide-slate-200 dark:divide-slate-800', className)}
      {...props}
    />
  );
}

function AppTableBodyRow({ className, ...props }: React.ComponentProps<typeof TableRow>) {
  return (
    <TableRow
      className={cn(
        'border-0 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/70',
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
        'px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sm:px-6 dark:text-slate-400',
        className,
      )}
      {...props}
    />
  );
}

function AppTableCell({ className, ...props }: React.ComponentProps<typeof TableCell>) {
  return (
    <TableCell
      className={cn('px-4 py-4 text-sm text-slate-700 sm:px-6 dark:text-slate-300', className)}
      {...props}
    />
  );
}

function AppTableFooterBar({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-3 border-t border-slate-100 bg-slate-50/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-slate-800 dark:bg-slate-900/50',
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
  AppTableFooterBar,
  AppTableHeadCell,
  AppTableHeaderRow,
  AppTableHeaderSection,
  AppTablePanel,
};
