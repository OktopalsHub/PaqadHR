'use client';

import { useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { useCalendarEvents } from '@/hooks/queries/use-calendar';
import { EVENT_COLORS, getEventsForDay, isSameDay, parseEventDate } from '../lib/calendar-utils';
import { CalendarEventPanel } from './calendar-event-panel';
import { CalendarToolbar } from './calendar-toolbar';

const DEFAULT_FILTERS = {
  leave: true,
  holiday: true,
  meeting: true,
  review: true,
  celebration: true,
};

export const CalendarView = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedTypes, setSelectedTypes] = useState<Record<string, boolean>>(DEFAULT_FILTERS);
  const { data: events = [], isLoading, isError, error } = useCalendarEvents();

  const filteredEvents = useMemo(
    () => events.filter((event) => selectedTypes[event.type]),
    [events, selectedTypes],
  );

  const selectedDateEvents = useMemo(() => {
    if (!date) return [];
    return filteredEvents.filter((event) => isSameDay(parseEventDate(event.date), date));
  }, [filteredEvents, date]);

  const toggleTypeFilter = (type: string) => {
    setSelectedTypes((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  return (
    <div className="h-full flex flex-col">
      <CalendarToolbar
        selectedTypes={selectedTypes}
        onToggleType={toggleTypeFilter}
        onSelectAll={() => setSelectedTypes(DEFAULT_FILTERS)}
      />

      {isLoading ? (
        <Skeleton className="m-4 h-96" />
      ) : isError ? (
        <Alert variant="destructive" className="m-4">
          <AlertTitle>Unable to load schedule</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Something went wrong'}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 flex-1 overflow-auto">
          <div className="md:col-span-3 h-full">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="w-full h-full rounded-md border pointer-events-auto"
              modifiers={{
                hasEvent: (day) => getEventsForDay(filteredEvents, day).length > 0,
              }}
              modifiersStyles={{ hasEvent: { fontWeight: 'bold' } }}
              components={{
                DayButton: ({ day, className, ...buttonProps }) => {
                  const dayEvents = getEventsForDay(filteredEvents, day.date);
                  return (
                    <button type="button" className={className} {...buttonProps}>
                      <div className="relative flex flex-col items-center justify-center h-full">
                        <div>{day.date.getDate()}</div>
                        {dayEvents.length > 0 && (
                          <div className="absolute bottom-1 flex gap-0.5">
                            {dayEvents.slice(0, 3).map((event) => (
                              <span
                                key={event.id}
                                className={`h-1 w-1 rounded-full ${EVENT_COLORS[event.type]}`}
                                title={event.title}
                              />
                            ))}
                            {dayEvents.length > 3 && (
                              <span
                                className="h-1 w-1 rounded-full bg-gray-400"
                                title={`+${dayEvents.length - 3} more events`}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                },
              }}
            />
          </div>

          <CalendarEventPanel date={date} events={selectedDateEvents} />
        </div>
      )}
    </div>
  );
};
