import { z } from "zod";

const memberSchema = z.object({
  id: z.string(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  preferredName: z.string().nullable().optional(),
});

export const shoutoutSchema = z.object({
  id: z.string(),
  message: z.string(),
  totalPoints: z.number(),
  createdAt: z.string(),
  sender: memberSchema,
  recipients: z.array(
    memberSchema.extend({
      points: z.number(),
    }),
  ),
  categories: z.array(
    z.object({
      id: z.string(),
      name: z.string().nullable().optional(),
      color: z.string().nullable().optional(),
    }),
  ),
});

export type Shoutout = z.infer<typeof shoutoutSchema>;

export const shoutoutFeedSchema = z.object({
  records: z.array(shoutoutSchema).optional(),
  data: z.array(shoutoutSchema).optional(),
  items: z.array(shoutoutSchema).optional(),
  shoutouts: z.array(shoutoutSchema).optional(),
  totalItems: z.number().optional(),
  total: z.number().optional(),
});

export type ShoutoutFeed = z.infer<typeof shoutoutFeedSchema>;

export const shoutoutCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export type ShoutoutCategory = z.infer<typeof shoutoutCategorySchema>;

export const createShoutoutInputSchema = z.object({
  recipientIds: z.array(z.string()).min(1),
  pointsPerRecipient: z.number().min(1),
  message: z.string().min(1).max(2000),
  categoryIds: z.array(z.string()).optional(),
});

export type CreateShoutoutInput = z.infer<typeof createShoutoutInputSchema>;
