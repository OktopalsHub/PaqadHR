'use client';

import { useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { AddCalendarEventDialog } from '@/features/calenders/components/add-calendar-event-dialog';
import { CalendarDayCell } from '@/features/calenders/components/calendar-day-cell';
import { formatDateKey, getEventsForDay } from '@/features/calenders/lib/calendar-utils';
import { useCalendarEvents } from '@/hooks/queries/use-calendar';
import { useTenant } from '@/providers/tenant-provider';
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
  const { tenant } = useTenant();
  const role = tenant?.member?.role?.toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin';

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [displayMonth, setDisplayMonth] = useState<Date>(new Date());
  const [selectedTypes, setSelectedTypes] = useState<Record<string, boolean>>(DEFAULT_FILTERS);
  const [addOpen, setAddOpen] = useState(false);
  const [addDialogDate, setAddDialogDate] = useState<string | undefined>();
  const { data: events = [], isLoading, isError, error } = useCalendarEvents();

  const filteredEvents = useMemo(
    () => events.filter((event) => selectedTypes[event.type]),
    [events, selectedTypes],
  );

  const referenceDate = displayMonth;

  const toggleTypeFilter = (type: string) => {
    setSelectedTypes((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const openAddDialog = (day?: Date) => {
    const target = day ?? date ?? new Date();
    setDate(target);
    setAddDialogDate(formatDateKey(target));
    setAddOpen(true);
  };

  const handleDaySelect = (day: Date | undefined) => {
    if (!day) {
      setDate(undefined);
      return;
    }
    setDate(day);
    if (isAdmin) {
      openAddDialog(day);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <CalendarToolbar
        selectedTypes={selectedTypes}
        onToggleType={toggleTypeFilter}
        onSelectAll={() => setSelectedTypes(DEFAULT_FILTERS)}
        canAddEvent={isAdmin}
        onAddEvent={() => openAddDialog()}
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
        <div className="grid flex-1 grid-cols-1 gap-4 overflow-auto p-4 md:grid-cols-4">
          <div className="h-full md:col-span-3">
            <Calendar
              mode="single"
              selected={date}
              onSelect={handleDaySelect}
              month={displayMonth}
              onMonthChange={setDisplayMonth}
              className="pointer-events-auto h-full w-full max-w-none rounded-md border [--cell-size:5.5rem] md:[--cell-size:6rem]"
              modifiers={{
                hasEvent: (day) => getEventsForDay(filteredEvents, day).length > 0,
              }}
              classNames={{
                root: 'w-full max-w-none',
                month: 'gap-3',
                weekdays: 'border-b border-border/50',
                weekday: 'pb-2 text-[0.75rem] font-medium',
                day: 'p-0.5',
              }}
              components={{
                DayButton: ({ day, ...buttonProps }) => (
                  <CalendarDayCell
                    day={day}
                    events={getEventsForDay(filteredEvents, day.date)}
                    {...buttonProps}
                  />
                ),
              }}
            />
          </div>
          <CalendarEventPanel referenceDate={referenceDate} events={filteredEvents} />
        </div>
      )}

      <AddCalendarEventDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultDate={addDialogDate}
      />
    </div>
  );
};
