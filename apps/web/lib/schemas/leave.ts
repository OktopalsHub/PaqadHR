import { z } from 'zod';

export const leaveStatusSchema = z.enum(['pending', 'approved', 'rejected', 'cancelled']);

export const leaveRequestSchema = z.object({
  id: z.string(),
  employee: z.string(),
  requesterId: z.string().optional(),
  type: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  days: z.number(),
  status: z.string(),
  reason: z.string(),
});

export type LeaveRequest = z.infer<typeof leaveRequestSchema>;

export const leaveBalanceSchema = z.object({
  leaveTypeId: z.string(),
  leaveTypeName: z.string(),
  allocated: z.number(),
  used: z.number(),
  remaining: z.number(),
});

export type LeaveBalance = z.infer<typeof leaveBalanceSchema>;

export const createLeaveSchema = z.object({
  leaveTypeId: z.string().min(1, 'Leave type is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  reason: z.string().min(1, 'Reason is required'),
});

export type CreateLeaveInput = z.infer<typeof createLeaveSchema>;
