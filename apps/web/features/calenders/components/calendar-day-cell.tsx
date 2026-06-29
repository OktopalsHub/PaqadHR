'use client';

import type { DayButtonProps } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import type { CalendarEvent } from '@/lib/schemas/calendar';
import { cn } from '@/lib/utils';
import { EVENT_CHIP_STYLES, sortDayEvents } from '../lib/calendar-utils';

const MAX_VISIBLE_EVENTS = 3;

type CalendarDayCellProps = DayButtonProps & {
  events: CalendarEvent[];
};

export function CalendarDayCell({
  day,
  modifiers,
  className,
  events,
  ...props
}: CalendarDayCellProps) {
  const sortedEvents = sortDayEvents(events);
  const visibleEvents = sortedEvents.slice(0, MAX_VISIBLE_EVENTS);
  const overflowCount = sortedEvents.length - visibleEvents.length;

  return (
    <Button
      type="button"
      variant="ghost"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        'h-auto min-h-(--cell-size) w-full max-w-full flex-col items-stretch justify-start gap-1 rounded-md p-1.5 text-left font-normal leading-none',
        'data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground',
        'data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground',
        'data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground',
        'data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground',
        'group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 group-data-[focused=true]/day:ring-[3px]',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'self-end text-xs font-semibold tabular-nums leading-none',
          modifiers.selected && 'text-inherit',
        )}
      >
        {day.date.getDate()}
      </span>

      {visibleEvents.length > 0 ? (
        <div className="flex w-full min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
          {visibleEvents.map((event) => (
            <span
              key={event.id}
              className={cn(
                'block w-full truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight',
                EVENT_CHIP_STYLES[event.type],
              )}
              title={event.title}
            >
              {event.title}
            </span>
          ))}
          {overflowCount > 0 ? (
            <span
              className={cn(
                'px-0.5 text-[10px] text-muted-foreground',
                modifiers.selected && 'text-primary-foreground/80',
              )}
            >
              +{overflowCount} more
            </span>
          ) : null}
        </div>
      ) : null}
    </Button>
  );
}
