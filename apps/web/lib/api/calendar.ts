import { apiClient, tenantPath } from "@/lib/api/client";
import { fetchLeaves } from "@/lib/api/leaves";
import { resolveTenantId } from "@/lib/api/tenants";
import type { CalendarEvent } from "@/lib/schemas/calendar";

type Celebration = {
  id: string;
  memberName: string;
  type: "birthday" | "anniversary";
  date: string;
};

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
    type: "leave",
    description: leave.reason,
  };
}

function celebrationToEvent(item: Celebration): CalendarEvent {
  return {
    id: `celebration-${item.id}`,
    title: `${item.memberName} — ${item.type === "birthday" ? "Birthday" : "Work Anniversary"}`,
    date: item.date,
    type: "celebration",
  };
}

export async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  const tenantId = await resolveTenantId();

  const [leaves, celebrations] = await Promise.all([
    fetchLeaves().catch(() => []),
    apiClient<Celebration[]>(tenantPath(tenantId, "celebrations")).catch(
      () => [],
    ),
  ]);

  return [
    ...leaves.map(leaveToEvent),
    ...celebrations.map(celebrationToEvent),
  ];
}
