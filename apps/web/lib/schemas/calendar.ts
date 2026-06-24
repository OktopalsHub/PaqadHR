import { z } from 'zod';

export const calendarEventTypeSchema = z.enum([
  'leave',
  'holiday',
  'meeting',
  'review',
  'celebration',
]);

export const calendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string(),
  type: calendarEventTypeSchema,
  description: z.string().optional(),
  time: z.string().optional(),
  reminder: z.string().optional(),
});

export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type CalendarEventType = z.infer<typeof calendarEventTypeSchema>;
