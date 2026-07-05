import { z } from 'zod';

export const departmentMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().optional(),
  role: z.string().optional(),
  position: z.string().optional(),
  avatar: z.string().optional(),
  initials: z.string(),
  isManager: z.boolean().optional(),
});

export const departmentTeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  memberCount: z.number(),
  members: z.array(departmentMemberSchema),
});

export const departmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  color: z.string(),
  manager: departmentMemberSchema.optional(),
  members: z.array(departmentMemberSchema),
  teams: z.array(departmentTeamSchema).optional(),
});

export type Department = z.infer<typeof departmentSchema>;
export type DepartmentMember = z.infer<typeof departmentMemberSchema>;
