'use client';

import { LayoutGrid, LayoutList } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ViewMode } from '../types/';

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  className?: string;
}

export const ViewModeToggle = ({ viewMode, onViewModeChange, className }: ViewModeToggleProps) => {
  return (
    <div className={cn('flex', className)}>
      <div className="flex h-10 items-center overflow-hidden rounded-[8px] border border-slate-200 bg-white">
        <button
          type="button"
          className={cn(
            'flex h-full w-10 items-center justify-center p-2 transition-colors',
            viewMode === 'list'
              ? 'bg-[#fbbf24] text-white'
              : 'bg-white text-slate-400 hover:bg-slate-50',
          )}
          onClick={() => onViewModeChange('list')}
        >
          <LayoutList size={20} />
          <span className="sr-only">List view</span>
        </button>
        <button
          type="button"
          className={cn(
            'flex h-full w-10 items-center justify-center p-2 transition-colors',
            viewMode === 'card'
              ? 'bg-[#fbbf24] text-white'
              : 'bg-white text-slate-400 hover:bg-slate-50',
          )}
          onClick={() => onViewModeChange('card')}
        >
          <LayoutGrid size={20} />
          <span className="sr-only">Card view</span>
        </button>
      </div>
    </div>
  );
};
