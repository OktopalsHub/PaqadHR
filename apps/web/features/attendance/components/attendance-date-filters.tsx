'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { DateRangePreset } from '@/features/attendance/lib/attendance-utils';
import { cn } from '@/lib/utils';

const PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: 'week', label: 'This week' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'month', label: 'This month' },
  { id: 'custom', label: 'Custom' },
];

type AttendanceDateFiltersProps = {
  preset: DateRangePreset;
  from: string;
  to: string;
  onPresetChange: (preset: DateRangePreset) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
};

export function AttendanceDateFilters({
  preset,
  from,
  to,
  onPresetChange,
  onFromChange,
  onToChange,
}: AttendanceDateFiltersProps) {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-end xl:justify-between">
      <div className="overflow-x-auto pb-1">
        <div className="app-segmented-control">
          {PRESETS.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant="ghost"
              className={cn(
                'rounded-[8px] px-4 text-sm whitespace-nowrap shadow-none',
                preset === item.id
                  ? 'border border-primary/25 bg-primary/12 font-semibold text-foreground hover:bg-primary/12'
                  : 'font-medium text-muted-foreground hover:bg-muted/35 hover:text-foreground',
              )}
              onClick={() => onPresetChange(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>
      {preset === 'custom' ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Input
            type="date"
            value={from}
            onChange={(e) => onFromChange(e.target.value)}
            className="app-input-surface w-full sm:w-[170px]"
          />
          <span className="text-sm text-muted-foreground sm:block">to</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => onToChange(e.target.value)}
            className="app-input-surface w-full sm:w-[170px]"
          />
        </div>
      ) : null}
    </div>
  );
}
