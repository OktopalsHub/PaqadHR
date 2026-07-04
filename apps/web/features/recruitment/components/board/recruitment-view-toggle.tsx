'use client';

import { LayoutGrid, LayoutList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type RecruitmentViewMode = 'kanban' | 'list';

type RecruitmentViewToggleProps = {
  view: RecruitmentViewMode;
  onViewChange: (view: RecruitmentViewMode) => void;
};

export function RecruitmentViewToggle({ view, onViewChange }: RecruitmentViewToggleProps) {
  return (
    <div className="flex h-10 items-center overflow-hidden rounded-[8px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/80">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          'h-full w-10 rounded-none border-0 shadow-none',
          view === 'kanban'
            ? 'bg-[#fbbf24] text-white hover:bg-[#fbbf24] hover:text-white'
            : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-900 dark:hover:text-slate-100',
        )}
        onClick={() => onViewChange('kanban')}
        aria-label="Kanban view"
        aria-pressed={view === 'kanban'}
      >
        <LayoutGrid className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          'h-full w-10 rounded-none border-0 shadow-none',
          view === 'list'
            ? 'bg-[#fbbf24] text-white hover:bg-[#fbbf24] hover:text-white'
            : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-900 dark:hover:text-slate-100',
        )}
        onClick={() => onViewChange('list')}
        aria-label="List view"
        aria-pressed={view === 'list'}
      >
        <LayoutList className="size-3.5" />
      </Button>
    </div>
  );
}
