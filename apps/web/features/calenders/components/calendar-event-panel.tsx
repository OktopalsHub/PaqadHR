import { format } from 'date-fns';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { CalendarEvent } from '@/lib/schemas/calendar';
import { cn } from '@/lib/utils';
import {
  buildEventAgenda,
  EVENT_BADGE_STYLES,
  EVENT_COLORS,
  type DayEventGroup,
} from '../lib/calendar-utils';

interface CalendarEventPanelProps {
  referenceDate: Date;
  events: CalendarEvent[];
}

function EventCard({ event, isPast }: { event: CalendarEvent; isPast: boolean }) {
  return (
    <Card className={cn('overflow-hidden', isPast && 'opacity-70')}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`size-2 shrink-0 rounded-full ${EVENT_COLORS[event.type]}`} />
            <span className={cn('truncate text-sm font-medium', isPast && 'line-through')}>
              {event.title}
            </span>
          </div>
          <Badge className={EVENT_BADGE_STYLES[event.type]} variant="outline">
            {event.type}
          </Badge>
        </div>
        {event.time ? (
          <div className={cn('mt-2 text-xs text-muted-foreground', isPast && 'line-through')}>
            {event.time}
          </div>
        ) : null}
        {event.reminder ? (
          <div className={cn('mt-1 text-xs text-muted-foreground', isPast && 'line-through')}>
            Reminder: {event.reminder}
          </div>
        ) : null}
        {event.description ? (
          <div className={cn('mt-1 text-sm text-muted-foreground', isPast && 'line-through')}>
            {event.description}
          </div>
        ) : null}
      </CardContent>
    </Card>
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
  const agenda = useMemo(
    () => buildEventAgenda(events, referenceDate),
    [events, referenceDate],
  );

  const hasAnyEvents =
    agenda.today.length > 0 || agenda.week.length > 0 || agenda.month.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col rounded-md border bg-card">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-medium">Schedule</h3>
        <p className="text-xs text-muted-foreground">{format(referenceDate, 'MMMM yyyy')}</p>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <AgendaSection
          title="Today"
          groups={agenda.today}
          emptyMessage="No events today."
        />
        <AgendaSection title="This week" groups={agenda.week} />
        <AgendaSection title="This month" groups={agenda.month} />

        {!hasAnyEvents ? (
          <p className="text-sm text-muted-foreground">No events this month.</p>
        ) : null}
      </div>
    </div>
  );
}
