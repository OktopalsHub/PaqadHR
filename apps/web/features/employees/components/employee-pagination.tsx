'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AppTableFooterBar } from '@/components/ui/app-table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ITEMS_PER_PAGE_OPTIONS } from '../constants/';

interface EmployeePaginationProps {
  currentPage: number;
  pageNumbers: number[];
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (itemsPerPage: number) => void;
}

export const EmployeePagination = ({
  currentPage,
  pageNumbers,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
}: EmployeePaginationProps) => {
  const pages = pageNumbers.length > 0 ? pageNumbers : [1];

  return (
    <AppTableFooterBar>
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <span className="text-sm text-slate-500">Show</span>
        <Select
          value={itemsPerPage.toString()}
          onValueChange={(val) => onItemsPerPageChange(Number.parseInt(val, 10))}
        >
          <SelectTrigger className="h-8 w-[72px] rounded-[8px] border-slate-200 bg-white py-1 pl-3 pr-8 text-sm text-slate-800 shadow-none focus-visible:border-transparent focus-visible:ring-1 focus-visible:ring-[#fbbf24]">
            <span className="font-medium tabular-nums text-slate-900">{itemsPerPage}</span>
          </SelectTrigger>
          <SelectContent>
            {ITEMS_PER_PAGE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-slate-500">per page</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Go to previous page"
          onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
          className={cn(
            'size-8 p-0 text-slate-400 shadow-none hover:bg-transparent hover:text-slate-800',
            currentPage === 1 && 'pointer-events-none opacity-30',
          )}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="size-5" />
        </Button>

        {pages.map((number) => (
          <Button
            key={number}
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onPageChange(number)}
            className={cn(
              'size-8 text-sm font-bold shadow-none',
              number === currentPage
                ? 'bg-slate-800 text-white hover:bg-slate-800 hover:text-white'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
            )}
          >
            {number}
          </Button>
        ))}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Go to next page"
          onClick={() => currentPage < pages.length && onPageChange(currentPage + 1)}
          className={cn(
            'size-8 p-0 text-slate-400 shadow-none hover:bg-transparent hover:text-slate-800',
            currentPage === pages.length && 'pointer-events-none opacity-30',
          )}
          disabled={currentPage === pages.length}
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>
    </AppTableFooterBar>
  );
};
