import { Filter, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { CalendarEventType } from '@/lib/schemas/calendar';
import { EVENT_COLORS } from '../lib/calendar-utils';

const FILTER_TYPES: { key: CalendarEventType; label: string }[] = [
  { key: 'leave', label: 'Leave' },
  { key: 'celebration', label: 'Celebration' },
  { key: 'holiday', label: 'Holiday' },
  { key: 'meeting', label: 'Meeting' },
  { key: 'review', label: 'Review' },
];

interface CalendarToolbarProps {
  selectedTypes: Record<string, boolean>;
  onToggleType: (type: string) => void;
  onSelectAll: () => void;
  onAddEvent?: () => void;
  canAddEvent?: boolean;
}

export function CalendarToolbar({
  selectedTypes,
  onToggleType,
  onSelectAll,
  onAddEvent,
  canAddEvent,
}: CalendarToolbarProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-[#d7e3f6] px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold tracking-tight text-slate-950 dark:text-slate-100">
          Schedule
        </h2>
        {canAddEvent ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Click a day or time slot to add an event
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
        {canAddEvent && onAddEvent ? (
          <Button variant="brandSolid" size="app" className="w-full sm:w-auto" onClick={onAddEvent}>
            <Plus className="size-4" />
            Add event
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="app"
              className="w-full border-slate-200 bg-white text-slate-700 shadow-none hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-slate-100 sm:w-auto"
            >
              <Filter className="size-4" />
              <span>Filter</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 rounded-[8px] border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
          >
            <div className="p-2">
              {FILTER_TYPES.map(({ key, label }) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={selectedTypes[key]}
                  onCheckedChange={() => onToggleType(key)}
                >
                  <span className={`mr-2 inline-block size-2 rounded-full ${EVENT_COLORS[key]}`} />
                  {label}
                </DropdownMenuCheckboxItem>
              ))}
            </div>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full border-slate-200 bg-white text-xs text-slate-700 shadow-none hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                onClick={onSelectAll}
              >
                Reset filters
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
