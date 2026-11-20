import { z } from 'zod';

export const screeningSchema = z.object({
  score: z.number().int().min(0).max(100),
  recommendation: z.enum(['advance', 'review', 'reject']),
  summary: z.string().max(600),
  strengths: z.array(z.string().max(200)).max(6),
  gaps: z.array(z.string().max(200)).max(6),
});

export const emailDraftSchema = z.object({
  subject: z.string().min(1).max(200),
  bodyHtml: z.string().min(1).max(8000),
});

export const jobDraftSchema = z.object({
  description: z.string().max(4000),
  responsibilities: z.array(z.string().max(300)).max(10),
  requirements: z.array(z.string().max(300)).max(10),
});

export type ScreeningResult = z.infer<typeof screeningSchema>;
export type EmailDraft = z.infer<typeof emailDraftSchema>;
export type JobDraft = z.infer<typeof jobDraftSchema>;

const UNSAFE_HTML = /<\s*(script|iframe|object|embed|style|link)\b|\son[a-z]+\s*=|javascript:/i;

export function isSafeEmailHtml(html: string): boolean {
  return !UNSAFE_HTML.test(html);
}
