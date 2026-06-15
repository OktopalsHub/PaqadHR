import { z } from 'zod';

export const tenantMemberSchema = z
  .object({
    id: z.string(),
    role: z.string().optional(),
    isActive: z.boolean().optional(),
  })
  .passthrough();

export const tenantSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    isActive: z.boolean(),
    member: tenantMemberSchema.optional(),
  })
  .passthrough();

export type Tenant = z.infer<typeof tenantSchema>;

export const paginatedTenantsSchema = z.object({
  records: z.array(tenantSchema),
  totalItems: z.number(),
  page: z.number(),
  limit: z.number(),
});
