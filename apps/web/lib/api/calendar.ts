import { apiClient, tenantPath } from '@/lib/api/client';
import type { Interview } from '@/lib/api/interviews';
import { fetchUpcomingInterviews } from '@/lib/api/interviews';
import { fetchLeaves } from '@/lib/api/leaves';
import { resolveTenantId } from '@/lib/api/tenants';
import type { CalendarEvent, CalendarEventType } from '@/lib/schemas/calendar';

type ApiCelebration = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
  type: 'birthday' | 'anniversary';
  date: string;
};

type Celebration = {
  id: string;
  memberName: string;
  type: 'birthday' | 'anniversary';
  date: string;
};

type Holiday = {
  id: string;
  name: string;
  date: string;
};

function mapCelebration(item: ApiCelebration): Celebration {
  const memberName =
    item.preferredName?.trim() ||
    [item.firstName, item.lastName].filter(Boolean).join(' ') ||
    'Team member';

  const date =
    typeof item.date === 'string'
      ? item.date.slice(0, 10)
      : new Date(item.date).toISOString().slice(0, 10);

  return {
    id: item.id,
    memberName,
    type: item.type,
    date,
  };
}

function leaveToEvent(leave: {
  id: string;
  employee: string;
  type: string;
  startDate: string;
  reason: string;
}): CalendarEvent {
  return {
    id: `leave-${leave.id}`,
    title: `${leave.employee} — ${leave.type}`,
    date: leave.startDate,
    type: 'leave',
    description: leave.reason,
  };
}

function celebrationToEvent(item: Celebration): CalendarEvent {
  return {
    id: `celebration-${item.id}`,
    title: `${item.memberName} — ${item.type === 'birthday' ? 'Birthday' : 'Work Anniversary'}`,
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
    ? [interview.candidate.firstName, interview.candidate.lastName].filter(Boolean).join(' ')
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

function holidayToEvent(holiday: Holiday): CalendarEvent {
  const date = holiday.date.length > 10 ? holiday.date.slice(0, 10) : holiday.date;

  return {
    id: `holiday-${holiday.id}`,
    title: holiday.name,
    date,
    type: 'holiday',
  };
}

async function fetchHolidayEvents(): Promise<CalendarEvent[]> {
  const tenantId = await resolveTenantId();
  const year = new Date().getFullYear();

  try {
    const holidays = await apiClient<Holiday[]>(
      tenantPath(tenantId, `settings/holidays/calendar/${year}`),
    );
    return (holidays ?? []).map(holidayToEvent);
  } catch {
    return [];
  }
}

export async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  const tenantId = await resolveTenantId();

  const [leaves, celebrations, interviews, holidays] = await Promise.all([
    fetchLeaves().catch(() => []),
    apiClient<ApiCelebration[]>(tenantPath(tenantId, 'celebrations')).catch(() => []),
    fetchUpcomingInterviews(90).catch(() => []),
    fetchHolidayEvents(),
  ]);

  return [
    ...leaves.map(leaveToEvent),
    ...celebrations.map(mapCelebration).map(celebrationToEvent),
    ...interviews.map(interviewToEvent),
    ...holidays,
  ];
}
