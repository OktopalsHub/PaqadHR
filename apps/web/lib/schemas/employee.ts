import { z } from 'zod';

export const employeeSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  department: z.string(),
  role: z.string(),
  status: z.enum(['Active', 'On Leave', 'Inactive']),
  joinDate: z.string(),
  avatar: z.string(),
  reportsToId: z.string().optional(),
  employeeNumber: z.string().optional(),
  departmentColor: z.string().optional(),
  positionColor: z.string().optional(),
});

export type Employee = z.infer<typeof employeeSchema>;

export const employeeListSchema = z.array(employeeSchema);
