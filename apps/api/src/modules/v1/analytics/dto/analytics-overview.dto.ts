import { ApiProperty } from '@nestjs/swagger';

export class AnalyticsTrendPointDto {
  @ApiProperty({ example: 'Jan' })
  label: string;

  @ApiProperty({ example: 12 })
  value: number;
}

export class AnalyticsStatusPointDto {
  @ApiProperty({ example: 'pending' })
  label: string;

  @ApiProperty({ example: 4 })
  value: number;
}

export class AnalyticsDepartmentPointDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Engineering' })
  name: string;

  @ApiProperty({ example: 18 })
  memberCount: number;
}

export class AnalyticsOverviewDto {
  @ApiProperty()
  generatedAt: string;

  @ApiProperty()
  workforce: {
    totalEmployees: number;
    activeEmployees: number;
    departmentCount: number;
    newHiresLast30Days: number;
  };

  @ApiProperty()
  leaves: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    onLeaveNow: number;
    byStatus: AnalyticsStatusPointDto[];
  };

  @ApiProperty()
  recruitment: {
    totalJobs: number;
    openRoles: number;
    totalCandidates: number;
    hired: number;
    pipelineByStatus: AnalyticsStatusPointDto[];
    applicationsByMonth: AnalyticsTrendPointDto[];
  };

  @ApiProperty()
  payroll: {
    totalRuns: number;
    completedRuns: number;
    lastRunAmount: number | null;
    lastRunCurrency: string | null;
    lastRunDate: string | null;
    lastRunTitle: string | null;
  };

  @ApiProperty()
  attendance: {
    attendanceRate: number | null;
    present: number;
    absent: number;
    late: number;
    onLeave: number;
    periodDays: number;
  };

  @ApiProperty()
  recognition: {
    shoutoutsThisMonth: number;
    pointsAwardedThisMonth: number;
  };

  @ApiProperty({ type: [AnalyticsDepartmentPointDto] })
  departments: AnalyticsDepartmentPointDto[];

  @ApiProperty({ type: [AnalyticsTrendPointDto] })
  headcountTrend: AnalyticsTrendPointDto[];
}
