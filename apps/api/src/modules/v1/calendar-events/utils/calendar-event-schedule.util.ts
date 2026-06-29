import type { TenantCalendarEvent } from '../entities/tenant-calendar-event.entity';

const ALL_DAY_DEFAULT_TIME = '09:00';
const CRON_WINDOW_MS = 5 * 60 * 1000;

type TemporalGlobal = {
  ZonedDateTime: {
    from: (iso: string) => { epochMilliseconds: number };
  };
};

export function resolveEventStartTime(event: Pick<TenantCalendarEvent, 'allDay' | 'startTime'>): string {
  if (event.allDay) return ALL_DAY_DEFAULT_TIME;
  return event.startTime?.slice(0, 5) ?? ALL_DAY_DEFAULT_TIME;
}

export function eventStartAtUtc(
  event: Pick<TenantCalendarEvent, 'startDate' | 'allDay' | 'startTime'>,
  timezone = 'UTC',
): Date {
  const date = event.startDate.slice(0, 10);
  const time = resolveEventStartTime(event);

  try {
    const temporal = (globalThis as { Temporal?: TemporalGlobal }).Temporal;
    if (temporal?.ZonedDateTime) {
      return new Date(temporal.ZonedDateTime.from(`${date}T${time}:00[${timezone}]`).epochMilliseconds);
    }
  } catch {
  }

  return new Date(`${date}T${time}:00.000Z`);
}

export function reminderAtUtc(
  event: Pick<TenantCalendarEvent, 'startDate' | 'allDay' | 'startTime' | 'reminderMinutes'>,
  timezone = 'UTC',
): Date | null {
  if (event.reminderMinutes == null) return null;
  const startAt = eventStartAtUtc(event, timezone);
  return new Date(startAt.getTime() - event.reminderMinutes * 60_000);
}

export function isReminderDue(
  reminderAt: Date,
  eventStartAt: Date,
  now = new Date(),
  windowMs = CRON_WINDOW_MS,
): boolean {
  if (now.getTime() >= eventStartAt.getTime()) return false;
  return now.getTime() >= reminderAt.getTime() && now.getTime() < reminderAt.getTime() + windowMs;
}

export function formatEventStartLabel(
  event: Pick<TenantCalendarEvent, 'startDate' | 'endDate' | 'allDay' | 'startTime' | 'endTime'>,
  timezone = 'UTC',
): string {
  const date = event.startDate.slice(0, 10);
  const start = eventStartAtUtc(event, timezone);

  const dateLabel = new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(start);

  if (event.allDay) {
    const endDate = event.endDate.slice(0, 10);
    if (endDate !== date) {
      return `${dateLabel} – ${endDate} (all day)`;
    }
    return `${dateLabel} (all day)`;
  }

  const startTime = resolveEventStartTime(event);
  const endTime = event.endTime?.slice(0, 5);
  const timeLabel = endTime && endTime !== startTime ? `${startTime} – ${endTime}` : startTime;
  return `${dateLabel} at ${timeLabel}`;
}

export function formatReminderLeadLabel(reminderMinutes: number): string {
  if (reminderMinutes === 0) return 'starting now';
  if (reminderMinutes < 60) return `in ${reminderMinutes} minutes`;
  if (reminderMinutes === 60) return 'in 1 hour';
  if (reminderMinutes === 1440) return 'tomorrow';
  if (reminderMinutes % 1440 === 0) {
    const days = reminderMinutes / 1440;
    return `in ${days} day${days === 1 ? '' : 's'}`;
  }
  if (reminderMinutes % 60 === 0) {
    const hours = reminderMinutes / 60;
    return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  }
  return `in ${reminderMinutes} minutes`;
}

export { CRON_WINDOW_MS };
