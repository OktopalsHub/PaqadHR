'use client';

import { CheckIcon } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { STAGE_COLOR_PALETTE } from '../lib/stage-colors';
import { StageColorDot } from './stage-color-dot';

type StageColorPickerProps = {
  stageName: string;
  value: string;
  onChange: (color: string) => void;
};

export function StageColorPicker({ stageName, value, onChange }: StageColorPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Change color for ${stageName}`}
          className="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 bg-white transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
        >
          <StageColorDot color={value} className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3">
        <div className="grid grid-cols-5 gap-2">
          {STAGE_COLOR_PALETTE.map((swatch) => {
            const selected = swatch.value.toLowerCase() === value.toLowerCase();
            return (
              <button
                key={swatch.value}
                type="button"
                title={swatch.name}
                aria-label={swatch.name}
                aria-pressed={selected}
                onClick={() => onChange(swatch.value)}
                className={cn(
                  'inline-flex size-7 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-white transition-transform hover:scale-110 dark:ring-offset-slate-900',
                  selected && 'ring-2 ring-slate-400',
                )}
                style={{ backgroundColor: swatch.value }}
              >
                {selected ? <CheckIcon className="size-3.5" /> : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
