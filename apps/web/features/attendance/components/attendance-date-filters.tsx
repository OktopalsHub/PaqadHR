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
        <div className="inline-flex min-w-max flex-nowrap items-center rounded-[8px] border border-slate-100 bg-white p-1 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] dark:border-slate-800 dark:bg-slate-950/75 dark:shadow-none">
          {PRESETS.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant="ghost"
              className={cn(
                'rounded-[8px] px-4 text-sm whitespace-nowrap shadow-none',
                preset === item.id
                  ? 'border border-slate-200 bg-slate-50 font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-900'
                  : 'font-medium text-slate-500 hover:bg-transparent hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100',
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
            className="w-full sm:w-[170px] border-slate-200 bg-white text-slate-700 shadow-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[#fbbf24] dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100"
          />
          <span className="text-sm text-slate-500 dark:text-slate-400 sm:block">to</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => onToChange(e.target.value)}
            className="w-full sm:w-[170px] border-slate-200 bg-white text-slate-700 shadow-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[#fbbf24] dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100"
          />
        </div>
      ) : null}
    </div>
  );
}
