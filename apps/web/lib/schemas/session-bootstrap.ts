import { z } from 'zod';
import { tenantSchema } from '@/lib/schemas/tenant';

export const sessionWorkspaceSchema = tenantSchema.extend({
  entitled: z.boolean(),
  needsPayment: z.boolean(),
  plan: z.string().nullable().optional(),
});

export const sessionBootstrapSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    role: z.string(),
  }),
  paymentsEnabled: z.boolean(),
  featureGatingEnabled: z.boolean(),
  workspaces: z.array(sessionWorkspaceSchema),
});

export type SessionWorkspace = z.infer<typeof sessionWorkspaceSchema>;
export type SessionBootstrap = z.infer<typeof sessionBootstrapSchema>;
