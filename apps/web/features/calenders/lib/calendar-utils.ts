import {
  endOfMonth,
  endOfWeek,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type { CalendarEvent, CalendarEventType } from '@/lib/schemas/calendar';

export const EVENT_COLORS: Record<CalendarEventType, string> = {
  leave: 'bg-orange-600',
  holiday: 'bg-blue-500',
  meeting: 'bg-purple-500',
  review: 'bg-green-600',
  celebration: 'bg-pink-500',
};

export const EVENT_BADGE_STYLES: Record<CalendarEventType, string> = {
  leave: 'bg-orange-50 text-orange-900 hover:bg-orange-50',
  holiday: 'bg-blue-50 text-blue-900 hover:bg-blue-50',
  meeting: 'bg-purple-50 text-purple-900 hover:bg-purple-50',
  review: 'bg-green-50 text-green-900 hover:bg-green-50',
  celebration: 'bg-pink-50 text-pink-900 hover:bg-pink-50',
};

export const EVENT_CHIP_STYLES: Record<CalendarEventType, string> = {
  leave:
    'bg-orange-950/5 text-orange-950/80 ring-1 ring-inset ring-orange-200/70 dark:bg-orange-950/30 dark:text-orange-100 dark:ring-orange-800/40',
  holiday:
    'bg-sky-950/5 text-sky-950/80 ring-1 ring-inset ring-sky-200/70 dark:bg-sky-950/30 dark:text-sky-100 dark:ring-sky-800/40',
  meeting:
    'bg-violet-950/5 text-violet-950/80 ring-1 ring-inset ring-violet-200/70 dark:bg-violet-950/30 dark:text-violet-100 dark:ring-violet-800/40',
  review:
    'bg-emerald-950/5 text-emerald-950/80 ring-1 ring-inset ring-emerald-200/70 dark:bg-emerald-950/30 dark:text-emerald-100 dark:ring-emerald-800/40',
  celebration:
    'bg-rose-950/5 text-rose-950/80 ring-1 ring-inset ring-rose-200/70 dark:bg-rose-950/30 dark:text-rose-100 dark:ring-rose-800/40',
};

export function parseEventDate(date: string) {
  return new Date(`${date}T12:00:00`);
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

export function getEventsForDay(events: CalendarEvent[], day: Date) {
  return events.filter((event) => isSameDay(parseEventDate(event.date), day));
}

const DAY_EVENT_PRIORITY: Record<CalendarEventType, number> = {
  holiday: 0,
  leave: 1,
  meeting: 2,
  review: 3,
  celebration: 4,
};

export function sortDayEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort(
    (a, b) =>
      DAY_EVENT_PRIORITY[a.type] - DAY_EVENT_PRIORITY[b.type] || a.title.localeCompare(b.title),
  );
}

export type DayEventGroup = {
  date: Date;
  dateKey: string;
  events: CalendarEvent[];
  isPast: boolean;
};

export type EventAgendaSections = {
  today: DayEventGroup[];
  week: DayEventGroup[];
  month: DayEventGroup[];
};

function groupEventsByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = event.date.slice(0, 10);
    const list = map.get(key) ?? [];
    list.push(event);
    map.set(key, list);
  }
  return map;
}

export function buildEventAgenda(
  events: CalendarEvent[],
  referenceDate = new Date(),
): EventAgendaSections {
  const todayStart = startOfDay(new Date());
  const todayKey = formatDateKey(todayStart);
  const weekStart = startOfWeek(todayStart, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(todayStart, { weekStartsOn: 1 });
  const monthStart = startOfMonth(referenceDate);
  const monthEnd = endOfMonth(referenceDate);
  const byDay = groupEventsByDay(events);

  const today: DayEventGroup[] = [];
  const week: DayEventGroup[] = [];
  const month: DayEventGroup[] = [];

  for (const key of [...byDay.keys()].sort()) {
    const dayEvents = byDay.get(key) ?? [];
    if (dayEvents.length === 0) continue;

    const date = parseEventDate(key);
    const dayStart = startOfDay(date);
    const group: DayEventGroup = {
      date,
      dateKey: key,
      events: dayEvents,
      isPast: dayStart < todayStart,
    };

    if (key === todayKey) {
      today.push(group);
      continue;
    }

    if (isWithinInterval(dayStart, { start: weekStart, end: weekEnd })) {
      week.push(group);
      continue;
    }

    if (isWithinInterval(dayStart, { start: monthStart, end: monthEnd })) {
      month.push(group);
    }
  }

  return { today, week, month };
}

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
