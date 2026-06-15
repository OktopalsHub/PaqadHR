import type { CalendarEventType } from "@/lib/schemas/calendar";

export type ScheduleEvent = {
  id: string;
  time: string;
  title: string;
  type: CalendarEventType;
};

export type ActivityItem = {
  id: string;
  actor: string;
  action: string;
  occurredAt: string;
};
