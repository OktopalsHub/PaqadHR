import type { CalendarEvent } from "@/lib/schemas/calendar";
import {
  getEventsForDay,
  parseEventDate,
} from "@/features/calenders/lib/calendar-utils";
import type { ScheduleEvent } from "./recruitment-types";

export function calendarEventsToSchedule(
  events: CalendarEvent[],
  day: Date = new Date(),
): ScheduleEvent[] {
  return getEventsForDay(events, day).map((event) => ({
    id: event.id,
    time: event.time ?? "All day",
    title: event.title,
    type: event.type,
  }));
}

export function isSameDayAsToday(dateStr: string) {
  const today = new Date();
  const eventDate = parseEventDate(dateStr);
  return (
    eventDate.getDate() === today.getDate() &&
    eventDate.getMonth() === today.getMonth() &&
    eventDate.getFullYear() === today.getFullYear()
  );
}
