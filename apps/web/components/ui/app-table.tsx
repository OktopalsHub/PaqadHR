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
        'min-w-0 overflow-hidden rounded-[8px] border border-border/60 bg-background/80 shadow-sm',
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
      className={cn('border-b border-border/60 bg-muted/40 hover:bg-muted/40', className)}
      {...props}
    />
  );
}

function AppTableBodySection({ className, ...props }: React.ComponentProps<typeof TableBody>) {
  return <TableBody className={cn('divide-y divide-border/60', className)} {...props} />;
}

function AppTableBodyRow({ className, ...props }: React.ComponentProps<typeof TableRow>) {
  return (
    <TableRow
      className={cn('border-0 transition-colors hover:bg-muted/25', className)}
      {...props}
    />
  );
}

function AppTableHeadCell({ className, ...props }: React.ComponentProps<typeof TableHead>) {
  return (
    <TableHead
      className={cn(
        'px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6',
        className,
      )}
      {...props}
    />
  );
}

function AppTableCell({ className, ...props }: React.ComponentProps<typeof TableCell>) {
  return (
    <TableCell className={cn('px-4 py-4 text-sm text-foreground sm:px-6', className)} {...props} />
  );
}

function AppTableFooterBar({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-3 border-t border-border/60 bg-muted/25 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6',
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
