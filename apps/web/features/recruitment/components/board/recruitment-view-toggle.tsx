'use client';

import { LayoutGrid, LayoutList } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type RecruitmentViewMode = 'kanban' | 'list';

type RecruitmentViewToggleProps = {
  view: RecruitmentViewMode;
  onViewChange: (view: RecruitmentViewMode) => void;
};

export function RecruitmentViewToggle({ view, onViewChange }: RecruitmentViewToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border/60 p-0.5">
      <Button
        type="button"
        variant={view === 'kanban' ? 'default' : 'ghost'}
        size="icon"
        className="size-7"
        onClick={() => onViewChange('kanban')}
        aria-label="Kanban view"
        aria-pressed={view === 'kanban'}
      >
        <LayoutGrid className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant={view === 'list' ? 'default' : 'ghost'}
        size="icon"
        className="size-7"
        onClick={() => onViewChange('list')}
        aria-label="List view"
        aria-pressed={view === 'list'}
      >
        <LayoutList className="size-3.5" />
      </Button>
    </div>
  );
}
