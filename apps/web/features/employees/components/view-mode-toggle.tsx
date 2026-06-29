'use client';
import { LayoutGrid, LayoutList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ViewMode } from '../types/';

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export const ViewModeToggle = ({ viewMode, onViewModeChange }: ViewModeToggleProps) => {
  return (
    <div className="flex justify-end space-x-2 mb-4">
      <Button
        variant={viewMode === 'list' ? 'default' : 'outline'}
        size="icon"
        onClick={() => onViewModeChange('list')}
      >
        <LayoutList size={16} />
        <span className="sr-only">List view</span>
      </Button>
      <Button
        variant={viewMode === 'card' ? 'default' : 'outline'}
        size="icon"
        onClick={() => onViewModeChange('card')}
      >
        <LayoutGrid size={16} />
        <span className="sr-only">Card view</span>
      </Button>
    </div>
  );
};
