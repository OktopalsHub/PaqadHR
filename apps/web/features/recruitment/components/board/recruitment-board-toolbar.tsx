import { Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type RecruitmentBoardToolbarProps = {
  title?: string;
  titleAction?: ReactNode;
  description?: string;
  qualifiedCount?: number;
  disqualifiedCount?: number;
  search?: string;
  onSearchChange?: (value: string) => void;
  showActions?: boolean;
  showCounters?: boolean;
  searchPlaceholder?: string;
  viewToggle?: ReactNode;
  className?: string;
};

export function RecruitmentBoardToolbar({
  title,
  titleAction,
  description,
  qualifiedCount = 0,
  disqualifiedCount = 0,
  search,
  onSearchChange,
  showActions = true,
  showCounters = true,
  searchPlaceholder = 'Search candidates...',
  viewToggle,
  className,
}: RecruitmentBoardToolbarProps) {
  return (
    <div
      className={cn(
        'rounded-[8px] border border-slate-100 bg-white p-4 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] dark:border-slate-800 dark:bg-slate-950/70 dark:shadow-none',
        className,
      )}
    >
      {title || description || titleAction || showActions || showCounters ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
              {title || titleAction ? (
                <div className="flex flex-wrap items-center gap-3">
                  {title ? (
                    <h2 className="text-[23px] font-semibold tracking-[-0.03em] text-slate-950 dark:text-slate-100">
                      {title}
                    </h2>
                  ) : null}
                  {titleAction ? <div className="shrink-0">{titleAction}</div> : null}
                </div>
              ) : null}
              {showCounters ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#d7e3f6] bg-[#eef4ff] px-3 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    Qualified
                    <span className="text-slate-950 dark:text-slate-100">{qualifiedCount}</span>
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#f1d9cf] bg-[#fff4ef] px-3 py-1 text-[11px] font-semibold text-[#9f4f2b] dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
                    Disqualified
                    <span className="text-[#6f2f14] dark:text-red-200">{disqualifiedCount}</span>
                  </span>
                </div>
              ) : null}
            </div>

            {showActions ? (
              <div className="flex w-full flex-col gap-3 lg:ml-auto lg:w-auto lg:min-w-[420px] lg:flex-row lg:items-center lg:justify-end">
                <div className="relative w-full lg:min-w-[320px] lg:max-w-[520px] xl:min-w-[360px] xl:max-w-xl">
                  <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <Input
                    placeholder={searchPlaceholder}
                    className="h-10 rounded-[8px] border-slate-200 bg-white py-2 pr-3 pl-10 text-sm text-slate-700 shadow-none placeholder:text-slate-400 focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[#fbbf24] dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder:text-slate-500"
                    value={search ?? ''}
                    onChange={(e) => onSearchChange?.(e.target.value)}
                    readOnly={!onSearchChange}
                  />
                </div>
                {viewToggle ? (
                  <div className="flex w-full justify-start lg:w-auto lg:justify-end">
                    {viewToggle}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          {description ? (
            <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
