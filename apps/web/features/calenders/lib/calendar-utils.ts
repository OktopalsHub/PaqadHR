import type { CalendarEvent, CalendarEventType } from '@/lib/schemas/calendar';

export const EVENT_COLORS: Record<CalendarEventType, string> = {
  leave: 'bg-amber-500',
  holiday: 'bg-blue-500',
  meeting: 'bg-purple-500',
  review: 'bg-green-500',
  celebration: 'bg-pink-500',
};

export const EVENT_BADGE_STYLES: Record<CalendarEventType, string> = {
  leave: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  holiday: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  meeting: 'bg-purple-100 text-purple-800 hover:bg-purple-100',
  review: 'bg-green-100 text-green-800 hover:bg-green-100',
  celebration: 'bg-pink-100 text-pink-800 hover:bg-pink-100',
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
