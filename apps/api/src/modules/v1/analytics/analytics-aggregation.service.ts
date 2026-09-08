import { Injectable } from '@nestjs/common';
import { AnalyticsActivityQueriesService } from './analytics-activity-queries.service';
import { AnalyticsWorkforceQueriesService } from './analytics-queries.service';
import type { AnalyticsOverviewDto } from './dto/analytics-overview.dto';

@Injectable()
export class AnalyticsAggregationService {
  constructor(
    private readonly workforce: AnalyticsWorkforceQueriesService,
    private readonly activity: AnalyticsActivityQueriesService,
  ) {}

  async getOverview(tenantId: string): Promise<AnalyticsOverviewDto> {
    const [
      workforce,
      leaves,
      recruitment,
      payroll,
      attendance,
      recognition,
      departments,
      headcountTrend,
    ] = await Promise.all([
      this.workforce.getWorkforceSummary(tenantId),
      this.workforce.getLeaveSummary(tenantId),
      this.workforce.getRecruitmentSummary(tenantId),
      this.workforce.getPayrollSummary(tenantId),
      this.activity.getAttendanceSummary(tenantId),
      this.activity.getRecognitionSummary(tenantId),
      this.workforce.getDepartmentBreakdown(tenantId),
      this.activity.getHeadcountTrend(tenantId),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      workforce,
      leaves,
      recruitment,
      payroll,
      attendance,
      recognition,
      departments,
      headcountTrend,
    };
  }
}
