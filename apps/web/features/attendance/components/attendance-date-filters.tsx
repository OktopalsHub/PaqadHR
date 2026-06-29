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
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((item) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant={preset === item.id ? 'default' : 'outline'}
            className={cn('h-8')}
            onClick={() => onPresetChange(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      {preset === 'custom' ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={from}
            onChange={(e) => onFromChange(e.target.value)}
            className="w-[150px]"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => onToChange(e.target.value)}
            className="w-[150px]"
          />
        </div>
      ) : null}
    </div>
  );
}
