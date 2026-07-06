import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AppTableFooterBar } from '@/components/ui/app-table';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LeavePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function LeavePagination({ currentPage, totalPages, onPageChange }: LeavePaginationProps) {
  if (totalPages <= 1) return null;

  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <AppTableFooterBar>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Page {currentPage} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Go to previous page"
          onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
          className={cn(
            'size-8 p-0 text-slate-400 shadow-none hover:bg-transparent hover:text-slate-800 dark:hover:text-slate-100',
            currentPage === 1 && 'pointer-events-none opacity-30',
          )}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="size-5" />
        </Button>

        {pageNumbers.map((number) => (
          <Button
            key={number}
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onPageChange(number)}
            className={cn(
              'size-8 text-sm font-bold shadow-none',
              number === currentPage
                ? 'bg-slate-800 text-white hover:bg-slate-800 hover:text-white dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-100 dark:hover:text-slate-950'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100',
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
          onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
          className={cn(
            'size-8 p-0 text-slate-400 shadow-none hover:bg-transparent hover:text-slate-800 dark:hover:text-slate-100',
            currentPage === totalPages && 'pointer-events-none opacity-30',
          )}
          disabled={currentPage === totalPages}
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>
    </AppTableFooterBar>
  );
}
