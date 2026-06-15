import { z } from "zod";

export const analyticsPointSchema = z.object({
  label: z.string(),
  value: z.number(),
});

export const analyticsDepartmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  memberCount: z.number(),
});

export const analyticsOverviewSchema = z.object({
  generatedAt: z.string(),
  workforce: z.object({
    totalEmployees: z.number(),
    activeEmployees: z.number(),
    departmentCount: z.number(),
    newHiresLast30Days: z.number(),
  }),
  leaves: z.object({
    total: z.number(),
    pending: z.number(),
    approved: z.number(),
    rejected: z.number(),
    onLeaveNow: z.number(),
    byStatus: z.array(analyticsPointSchema),
  }),
  recruitment: z.object({
    totalJobs: z.number(),
    openRoles: z.number(),
    totalCandidates: z.number(),
    hired: z.number(),
    pipelineByStatus: z.array(analyticsPointSchema),
    applicationsByMonth: z.array(analyticsPointSchema),
  }),
  payroll: z.object({
    totalRuns: z.number(),
    completedRuns: z.number(),
    lastRunAmount: z.number().nullable(),
    lastRunCurrency: z.string().nullable(),
    lastRunDate: z.string().nullable(),
    lastRunTitle: z.string().nullable(),
  }),
  attendance: z.object({
    attendanceRate: z.number().nullable(),
    present: z.number(),
    absent: z.number(),
    late: z.number(),
    onLeave: z.number(),
    periodDays: z.number(),
  }),
  recognition: z.object({
    shoutoutsThisMonth: z.number(),
    pointsAwardedThisMonth: z.number(),
  }),
  departments: z.array(analyticsDepartmentSchema),
  headcountTrend: z.array(analyticsPointSchema),
});

export type AnalyticsOverview = z.infer<typeof analyticsOverviewSchema>;
export type AnalyticsPoint = z.infer<typeof analyticsPointSchema>;
