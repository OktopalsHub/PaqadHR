import { z } from 'zod';

export const calendarEventTypeSchema = z.enum([
  'leave',
  'holiday',
  'meeting',
  'review',
  'celebration',
]);

export const calendarManualEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  startDate: z.string(),
  endDate: z.string(),
  allDay: z.boolean().optional(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  reminderMinutes: z.number().nullable().optional(),
  type: z.string(),
  createdBy: z.string(),
});

export const calendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string(),
  type: calendarEventTypeSchema,
  description: z.string().optional(),
  time: z.string().optional(),
  reminder: z.string().optional(),
  manualEvent: calendarManualEventSchema.optional(),
});

export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type CalendarEventType = z.infer<typeof calendarEventTypeSchema>;
