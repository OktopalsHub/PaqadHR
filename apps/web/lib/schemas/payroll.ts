import { z } from 'zod';

export const payrollRunSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  frequency: z.string().optional(),
  periodStart: z.string(),
  periodEnd: z.string(),
  paymentDate: z.string().optional(),
  baseCurrency: z.string(),
  employeeCount: z.number().optional(),
  totalNetAmount: z.union([z.number(), z.string()]).optional(),
  totalGrossAmount: z.union([z.number(), z.string()]).optional(),
  createdAt: z.string().optional(),
  processedAt: z.string().nullable().optional(),
});

export type PayrollRun = z.infer<typeof payrollRunSchema>;

export const payrollRunsResponseSchema = z.object({
  runs: z.array(payrollRunSchema),
  total: z.number(),
});

export type PayrollRunsResponse = z.infer<typeof payrollRunsResponseSchema>;

export const payrollReadinessItemSchema = z.object({
  itemId: z.string(),
  memberId: z.string(),
  employeeName: z.string(),
  ready: z.boolean(),
  issues: z.array(z.string()),
  message: z.string(),
  netAmount: z.number(),
  status: z.string(),
  paymentMethodId: z.string().optional(),
  currency: z.string().optional(),
});

export const payrollReadinessSchema = z.object({
  payrollRunId: z.string(),
  currency: z.string(),
  totalEmployees: z.number(),
  readyCount: z.number(),
  notReadyCount: z.number(),
  canApprove: z.boolean(),
  items: z.array(payrollReadinessItemSchema),
});

export type PayrollReadiness = z.infer<typeof payrollReadinessSchema>;

export const createPayrollRunInputSchema = z.object({
  title: z.string().min(3),
  frequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'annually']),
  periodStart: z.string(),
  periodEnd: z.string(),
  paymentDate: z.string(),
  baseCurrency: z.string(),
  employeeIds: z.array(z.string()).min(1),
});

export type CreatePayrollRunInput = z.infer<typeof createPayrollRunInputSchema>;
