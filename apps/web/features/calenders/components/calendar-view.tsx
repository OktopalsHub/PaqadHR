'use client';

import { useMemo, useState } from 'react';
import { AppPage } from '@/components/app-page';
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
    <AppPage className="mx-auto w-full max-w-7xl">
      <div className="dashboard-panel overflow-hidden rounded-[8px]">
        <CalendarToolbar
          selectedTypes={selectedTypes}
          onToggleType={toggleTypeFilter}
          onSelectAll={() => setSelectedTypes(DEFAULT_FILTERS)}
          canAddEvent={isAdmin}
          onAddEvent={() => openAddDialog()}
        />

        {isLoading ? (
          <div className="p-5">
            <Skeleton className="h-[38rem] rounded-[8px]" />
          </div>
        ) : isError ? (
          <div className="p-5">
            <Alert variant="destructive">
              <AlertTitle>Unable to load schedule</AlertTitle>
              <AlertDescription>
                {error instanceof Error ? error.message : 'Something went wrong'}
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.65fr)_340px]">
            <div className="dashboard-soft-tile rounded-[8px] border border-[#d7e3f6] p-4 dark:border-slate-800">
              <Calendar
                mode="single"
                selected={date}
                onSelect={handleDaySelect}
                month={displayMonth}
                onMonthChange={setDisplayMonth}
                className="pointer-events-auto h-full w-full max-w-none rounded-[8px] border border-[#d7e3f6] bg-white/70 [--cell-size:5.25rem] md:[--cell-size:5.75rem] dark:border-slate-800 dark:bg-slate-950/50"
                modifiers={{
                  hasEvent: (day) => getEventsForDay(filteredEvents, day).length > 0,
                }}
                classNames={{
                  root: 'w-full max-w-none',
                  month: 'gap-3',
                  weekdays: 'border-b border-border/50',
                  weekday: 'pb-2 text-[0.75rem] font-medium uppercase tracking-[0.08em]',
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
      </div>

      <AddCalendarEventDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultDate={addDialogDate}
      />
    </AppPage>
  );
};
