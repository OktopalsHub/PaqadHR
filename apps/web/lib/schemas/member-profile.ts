import { z } from 'zod';

export const memberProfileSchema = z.object({
  id: z.string(),
  firstName: z.string().optional().default(''),
  lastName: z.string().optional().default(''),
  preferredName: z.string().nullish(),
  avatarUrl: z.string().nullish(),
  avatarKey: z.string().nullish(),
  position: z.object({ id: z.string(), title: z.string() }).optional(),
});

export type MemberProfile = z.infer<typeof memberProfileSchema>;
