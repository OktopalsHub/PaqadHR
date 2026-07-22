import { z } from 'zod';

export const payrollRunSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  frequency: z.string().optional(),
  periodStart: z.string(),
  periodEnd: z.string(),
  paymentDate: z.string().optional(),
  payoutMode: z.enum(['immediate', 'scheduled']).nullable().optional(),
  baseCurrency: z.string(),
  employeeCount: z.number().optional(),
  totalNetAmount: z.union([z.number(), z.string()]).optional(),
  totalGrossAmount: z.union([z.number(), z.string()]).optional(),
  createdAt: z.string().optional(),
  processedAt: z.string().nullable().optional(),
  alreadyExists: z.boolean().optional(),
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

export const payrollAdjustmentLineSchema = z.object({
  employeeId: z.string(),
  type: z.string(),
  method: z.enum(['fixed_amount', 'percentage']),
  value: z.number(),
  reason: z.string(),
  notes: z.string().optional(),
});

export type PayrollAdjustmentLine = z.infer<typeof payrollAdjustmentLineSchema>;

export const payrollItemSchema = z.object({
  id: z.string(),
  memberId: z.string(),
  status: z.string(),
  baseSalary: z.union([z.number(), z.string()]).optional(),
  baseSalaryCurrency: z.string().optional(),
  grossAmount: z.union([z.number(), z.string()]).optional(),
  adjustments: z.union([z.number(), z.string()]).optional(),
  deductions: z.union([z.number(), z.string()]).optional(),
  netAmount: z.union([z.number(), z.string()]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  employee: z
    .object({
      firstName: z.string().optional().nullable(),
      lastName: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
});

export type PayrollItem = z.infer<typeof payrollItemSchema>;

export const payrollRunDetailSchema = payrollRunSchema.extend({
  items: z.array(payrollItemSchema).optional(),
});

export type PayrollRunDetail = z.infer<typeof payrollRunDetailSchema>;

export const runPayslipSchema = z.object({
  itemId: z.string(),
  runId: z.string(),
  memberId: z.string(),
  employeeName: z.string(),
  published: z.boolean(),
  paidAt: z.union([z.string(), z.date()]).nullable().optional(),
});

export type RunPayslip = z.infer<typeof runPayslipSchema>;

export const publishedPayslipSchema = z.object({
  itemId: z.string(),
  runId: z.string(),
  memberId: z.string(),
  employeeName: z.string(),
  runTitle: z.string(),
  periodStart: z.union([z.string(), z.date()]).optional(),
  periodEnd: z.union([z.string(), z.date()]).optional(),
  netAmount: z.union([z.number(), z.string()]).optional(),
  currency: z.string().optional(),
  paidAt: z.union([z.string(), z.date()]).nullable().optional(),
  publishedAt: z.string().optional(),
});

export type PublishedPayslip = z.infer<typeof publishedPayslipSchema>;
