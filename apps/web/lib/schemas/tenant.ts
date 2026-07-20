import { z } from 'zod';

export const tenantMemberSchema = z
  .object({
    id: z.string(),
    role: z.string().optional(),
    isActive: z.boolean().optional(),
  })
  .passthrough();

export const tenantSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  isActive: z.boolean().default(true),
  logoUrl: z.string().optional(),
  industry: z.string().optional(),
  location: z.string().optional(),
  companySize: z.string().optional(),
  employeeCode: z.string().optional(),
  countryCode: z.string().optional(),
  timezone: z.string().optional(),
  preferredCurrency: z.string().optional(),
  member: tenantMemberSchema.optional(),
  settings: z.unknown().optional(),
});

export type Tenant = z.infer<typeof tenantSchema>;

export const paginatedTenantsSchema = z.object({
  records: z.array(tenantSchema),
  totalItems: z.number(),
  page: z.number(),
  limit: z.number(),
});
