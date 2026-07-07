import { format } from 'date-fns';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import type { CalendarEvent } from '@/lib/schemas/calendar';
import { cn } from '@/lib/utils';
import {
  buildEventAgenda,
  type DayEventGroup,
  EVENT_BADGE_STYLES,
  EVENT_COLORS,
} from '../lib/calendar-utils';

interface CalendarEventPanelProps {
  referenceDate: Date;
  events: CalendarEvent[];
}

function EventCard({ event, isPast }: { event: CalendarEvent; isPast: boolean }) {
  return (
    <div
      className={cn(
        'dashboard-soft-tile rounded-[8px] border border-[#d7e3f6] p-3.5 dark:border-slate-800',
        isPast && 'opacity-70',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`size-2 shrink-0 rounded-full ${EVENT_COLORS[event.type]}`} />
          <span
            className={cn(
              'truncate text-sm font-medium text-slate-900 dark:text-slate-100',
              isPast && 'line-through',
            )}
          >
            {event.title}
          </span>
        </div>
        <Badge className={EVENT_BADGE_STYLES[event.type]} variant="outline">
          {event.type}
        </Badge>
      </div>
      {event.time ? (
        <div
          className={cn(
            'mt-2 text-xs text-slate-500 dark:text-slate-400',
            isPast && 'line-through',
          )}
        >
          {event.time}
        </div>
      ) : null}
      {event.reminder ? (
        <div
          className={cn(
            'mt-1 text-xs text-slate-500 dark:text-slate-400',
            isPast && 'line-through',
          )}
        >
          Reminder: {event.reminder}
        </div>
      ) : null}
      {event.description ? (
        <div
          className={cn(
            'mt-1 text-sm text-slate-600 dark:text-slate-400',
            isPast && 'line-through',
          )}
        >
          {event.description}
        </div>
      ) : null}
    </div>
  );
}

function DayGroup({ group }: { group: DayEventGroup }) {
  return (
    <div className="space-y-2">
      <p
        className={cn(
          'text-xs font-medium text-foreground',
          group.isPast && 'text-muted-foreground line-through',
        )}
      >
        {format(group.date, 'EEEE, MMMM d')}
      </p>
      <div className="space-y-2">
        {group.events.map((event) => (
          <EventCard key={event.id} event={event} isPast={group.isPast} />
        ))}
      </div>
    </div>
  );
}

function AgendaSection({
  title,
  groups,
  emptyMessage,
}: {
  title: string;
  groups: DayEventGroup[];
  emptyMessage?: string;
}) {
  if (groups.length === 0 && !emptyMessage) return null;

  return (
    <section>
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      {groups.length > 0 ? (
        <div className="space-y-4">
          {groups.map((group) => (
            <DayGroup key={group.dateKey} group={group} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      )}
    </section>
  );
}

export function CalendarEventPanel({ referenceDate, events }: CalendarEventPanelProps) {
  const agenda = useMemo(() => buildEventAgenda(events, referenceDate), [events, referenceDate]);

  const hasAnyEvents = agenda.today.length > 0 || agenda.week.length > 0 || agenda.month.length > 0;

  return (
    <div className="dashboard-panel flex h-full min-h-0 flex-col rounded-[8px] overflow-hidden">
      <div className="border-b border-[#d7e3f6] px-5 py-4 dark:border-slate-800">
        <h3 className="text-[17px] font-semibold tracking-tight text-slate-950 dark:text-slate-100">
          Agenda
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {format(referenceDate, 'MMMM yyyy')}
        </p>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        <AgendaSection title="Today" groups={agenda.today} emptyMessage="No events today." />
        <AgendaSection title="This week" groups={agenda.week} />
        <AgendaSection title="This month" groups={agenda.month} />

        {!hasAnyEvents ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No events this month.</p>
        ) : null}
      </div>
    </div>
  );
}
