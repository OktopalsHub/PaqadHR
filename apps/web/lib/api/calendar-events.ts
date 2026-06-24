import { apiClient, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';

export interface CalendarEventRecord {
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
  createdBy: string;
}

export async function fetchCalendarEvents(from?: string, to?: string): Promise<CalendarEventRecord[]> {
  const tenantId = await resolveTenantId();
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString();
  return apiClient<CalendarEventRecord[]>(
    `${tenantPath(tenantId, 'calendar-events')}${query ? `?${query}` : ''}`,
  );
}

export async function createCalendarEvent(input: {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  allDay?: boolean;
  startTime?: string;
  endTime?: string;
  reminderMinutes?: number | null;
  type?: string;
}): Promise<CalendarEventRecord> {
  const tenantId = await resolveTenantId();
  return apiClient<CalendarEventRecord>(tenantPath(tenantId, 'calendar-events'), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, `calendar-events/${eventId}`), { method: 'DELETE' });
}
