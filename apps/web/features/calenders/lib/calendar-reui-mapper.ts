import { addDays, addHours, parse, startOfDay } from 'date-fns';
import type { CalendarEvent as ReuiCalendarEvent } from '@/components/reui/event-calendar/event-calendar-types';
import { parseEventDate } from '@/features/calenders/lib/calendar-utils';
import type { CalendarEvent, CalendarEventType } from '@/lib/schemas/calendar';

export const REUI_EVENT_COLORS: Record<CalendarEventType, string> = {
  leave: '#ea580c',
  holiday: '#3b82f6',
  meeting: '#9333ea',
  review: '#16a34a',
  celebration: '#db2777',
};

type PaqadEventMeta = {
  source: CalendarEvent;
  manual: boolean;
};

function parseTimeOnDate(day: Date, timeLabel: string): Date | null {
  const trimmed = timeLabel.trim();
  const rangeMatch = trimmed.match(/^(.+?)\s*[–-]\s*(.+)$/);
  const startLabel = rangeMatch?.[1]?.trim() ?? trimmed;

  for (const pattern of ['h:mm a', 'HH:mm', 'H:mm']) {
    const parsed = parse(startLabel, pattern, day);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

function parseEndFromRange(day: Date, timeLabel: string, fallbackStart: Date): Date {
  const trimmed = timeLabel.trim();
  const rangeMatch = trimmed.match(/^(.+?)\s*[–-]\s*(.+)$/);
  if (!rangeMatch?.[2]) return addHours(fallbackStart, 1);

  for (const pattern of ['h:mm a', 'HH:mm', 'H:mm']) {
    const parsed = parse(rangeMatch[2].trim(), pattern, day);
    if (!Number.isNaN(parsed.getTime()) && parsed > fallbackStart) return parsed;
  }

  return addHours(fallbackStart, 1);
}

function parseInterviewDuration(description?: string): number {
  const match = description?.match(/(\d+)\s*min/i);
  if (!match) return 60;
  const minutes = Number(match[1]);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 60;
}

export function paqadEventToReui(event: CalendarEvent): ReuiCalendarEvent<PaqadEventMeta> {
  const day = parseEventDate(event.date);
  const manual = event.id.startsWith('manual-');

  if (event.time) {
    const start = parseTimeOnDate(day, event.time) ?? startOfDay(day);
    const end =
      event.type === 'meeting' || event.type === 'review'
        ? addHours(start, parseInterviewDuration(event.description) / 60)
        : parseEndFromRange(day, event.time, start);

    return {
      id: event.id,
      title: event.title,
      start,
      end: end > start ? end : addHours(start, 1),
      allDay: false,
      color: REUI_EVENT_COLORS[event.type],
      readOnly: true,
      data: { source: event, manual },
    };
  }

  const start = startOfDay(day);
  return {
    id: event.id,
    title: event.title,
    start,
    end: addDays(start, 1),
    allDay: true,
    color: REUI_EVENT_COLORS[event.type],
    readOnly: true,
    data: { source: event, manual },
  };
}

export function paqadEventsToReui(events: CalendarEvent[]): ReuiCalendarEvent<PaqadEventMeta>[] {
  return events.map(paqadEventToReui);
}
