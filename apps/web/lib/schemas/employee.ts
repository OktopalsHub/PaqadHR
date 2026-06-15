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
});

export type Employee = z.infer<typeof employeeSchema>;

export const employeeListSchema = z.array(employeeSchema);
