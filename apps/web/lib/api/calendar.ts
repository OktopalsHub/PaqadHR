import { formatReminderLabel, formatTimeRange } from '@/features/calenders/lib/calendar-event-form';
import { fetchCalendarEvents as fetchManualCalendarEvents } from '@/lib/api/calendar-events';
import { apiClient, tenantPath } from '@/lib/api/client';
import type { Interview } from '@/lib/api/interviews';
import { fetchUpcomingInterviews } from '@/lib/api/interviews';
import { fetchLeavesForCalendar } from '@/lib/api/leaves';
import { resolveTenantId } from '@/lib/api/tenants';
import { formatDisplayName, formatPersonName } from '@/lib/format-name';
import { formatOrdinal } from '@/lib/format-ordinal';
import type { CalendarEvent, CalendarEventType } from '@/lib/schemas/calendar';

type ApiCelebration = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
  type: 'birthday' | 'anniversary';
  date: string;
  years?: number;
};

type Celebration = {
  id: string;
  memberName: string;
  type: 'birthday' | 'anniversary';
  date: string;
  years?: number;
};

type Holiday = {
  id: string;
  name: string;
  date: string;
};

function eachDayInclusive(startIso: string, endIso: string): string[] {
  const days: string[] = [];
  const start = new Date(startIso.slice(0, 10));
  const end = new Date(endIso.slice(0, 10));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [startIso.slice(0, 10)];
  }
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function normalizeCelebrationDate(rawDate: string, year = new Date().getFullYear()): string {
  const parts = rawDate.slice(0, 10).split('-');
  if (parts.length < 3) return rawDate.slice(0, 10);
  return `${year}-${parts[1]}-${parts[2]}`;
}

function mapCelebration(item: ApiCelebration): Celebration {
  const memberName =
    formatDisplayName(item.preferredName, '') ||
    formatPersonName(item.firstName, item.lastName, 'Team member');

  return {
    id: item.id,
    memberName,
    type: item.type,
    date: normalizeCelebrationDate(
      typeof item.date === 'string' ? item.date : new Date(item.date).toISOString(),
    ),
    years: item.years,
  };
}

function leaveToEvents(leave: {
  id: string;
  employee: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
}): CalendarEvent[] {
  return eachDayInclusive(leave.startDate, leave.endDate).map((date) => ({
    id: `leave-${leave.id}-${date}`,
    title: `${leave.employee} — ${leave.type}`,
    date,
    type: 'leave' as const,
    description: leave.reason,
  }));
}

function celebrationToEvent(item: Celebration): CalendarEvent {
  const anniversaryLabel =
    item.years && item.years >= 1
      ? `${formatOrdinal(item.years)} Work Anniversary`
      : 'Work Anniversary';
  return {
    id: `celebration-${item.id}-${item.date}`,
    title: `${item.memberName} — ${item.type === 'birthday' ? 'Birthday' : anniversaryLabel}`,
    date: item.date,
    type: 'celebration',
  };
}

function interviewEventType(type: string): CalendarEventType {
  const normalized = type.toLowerCase();
  if (normalized.includes('technical') || normalized.includes('review')) {
    return 'review';
  }
  return 'meeting';
}

function formatInterviewTime(dateStr: string) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function interviewToEvent(interview: Interview): CalendarEvent {
  const candidateName = interview.candidate
    ? formatPersonName(interview.candidate.firstName, interview.candidate.lastName, '')
    : '';
  const roleTitle = interview.jobOpening?.title ?? 'Interview';
  const title = candidateName ? `${candidateName} — ${roleTitle}` : roleTitle;

  return {
    id: `interview-${interview.id}`,
    title,
    date: new Date(interview.date).toISOString().slice(0, 10),
    type: interviewEventType(interview.type),
    time: formatInterviewTime(interview.date),
    description: `${interview.duration} min · ${interview.type}`,
  };
}

function normalizeDbTime(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  return raw.slice(0, 5);
}

function manualEventToCalendar(event: {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  allDay?: boolean;
  startTime?: string | null;
  endTime?: string | null;
  reminderMinutes?: number | null;
  type: string;
}): CalendarEvent[] {
  const eventType: CalendarEventType =
    event.type === 'review' ? 'review' : event.type === 'reminder' ? 'meeting' : 'meeting';
  const timeLabel =
    event.allDay === false
      ? formatTimeRange(normalizeDbTime(event.startTime), normalizeDbTime(event.endTime))
      : undefined;
  const reminderLabel = formatReminderLabel(event.reminderMinutes);

  return eachDayInclusive(event.startDate, event.endDate).map((date, index) => ({
    id: `manual-${event.id}-${date}`,
    title: event.title,
    date,
    type: eventType,
    description: event.description,
    time: index === 0 ? timeLabel : undefined,
    reminder: index === 0 ? reminderLabel : undefined,
  }));
}

function normalizeHolidayDateString(raw: string, fallbackYear?: number): string {
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  if (/^\d{2}-\d{2}$/.test(raw)) {
    const year = fallbackYear ?? new Date().getFullYear();
    return `${year}-${raw}`;
  }
  return raw.slice(0, 10);
}

function holidayToEvent(holiday: Holiday, year?: number): CalendarEvent {
  const date = normalizeHolidayDateString(holiday.date, year);

  return {
    id: `holiday-${holiday.id}-${date}`,
    title: holiday.name,
    date,
    type: 'holiday',
  };
}

async function fetchHolidayEvents(fromYear: number, toYear: number): Promise<CalendarEvent[]> {
  const tenantId = await resolveTenantId();
  const years: number[] = [];
  for (let year = fromYear; year <= toYear; year++) {
    years.push(year);
  }

  const holidayLists = await Promise.all(
    years.map((year) =>
      apiClient<Holiday[]>(tenantPath(tenantId, `settings/holidays/calendar/${year}`))
        .then((holidays) => holidays.map((holiday) => holidayToEvent(holiday, year)))
        .catch(() => [] as CalendarEvent[]),
    ),
  );

  const seen = new Set<string>();
  return holidayLists.flat().filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}

export async function fetchCalendarEvents(dateRange?: {
  from: string;
  to: string;
}): Promise<CalendarEvent[]> {
  const tenantId = await resolveTenantId();
  const year = new Date().getFullYear();
  const from = dateRange?.from ?? `${year - 1}-01-01`;
  const to = dateRange?.to ?? `${year + 1}-12-31`;

  const [leaves, celebrations, interviews, holidays, manualEvents] = await Promise.all([
    fetchLeavesForCalendar({ status: 'approved', from, to, limit: 200 }).catch(() => []),
    apiClient<ApiCelebration[]>(tenantPath(tenantId, 'celebrations')).catch(() => []),
    fetchUpcomingInterviews(365).catch(() => []),
    fetchHolidayEvents(year - 1, year + 1),
    fetchManualCalendarEvents(from, to).catch(() => []),
  ]);

  return [
    ...leaves.flatMap((leave) =>
      leaveToEvents({
        id: leave.id,
        employee: leave.employee,
        type: leave.type,
        startDate: leave.startDate,
        endDate: leave.endDate,
        reason: leave.reason ?? '',
      }),
    ),
    ...celebrations.map(mapCelebration).map(celebrationToEvent),
    ...interviews.map(interviewToEvent),
    ...holidays,
    ...manualEvents.flatMap(manualEventToCalendar),
  ];
}
