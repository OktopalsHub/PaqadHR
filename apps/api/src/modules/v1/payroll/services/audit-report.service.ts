import { Injectable } from '@nestjs/common';
import type { TenantActivity } from '../../activities/entities/tenant-activity.entity';
import { ActivitiesService } from '../../activities/services/activities.service';

@Injectable()
export class AuditReportService {
  constructor(protected readonly activitiesService: ActivitiesService) {}

  async getAuditTrail(payrollRunId: string, tenantId: string): Promise<TenantActivity[]> {
    return this.activitiesService.listForResource(tenantId, 'payroll', payrollRunId, 100);
  }

  async generateAuditReport(
    payrollRunId: string,
    tenantId: string,
  ): Promise<{
    payrollRunId: string;
    totalEvents: number;
    eventsByType: Record<string, number>;
    timeline: TenantActivity[];
    generatedAt: Date;
  }> {
    const activities = await this.getAuditTrail(payrollRunId, tenantId);
    const eventsByType: Record<string, number> = {};
    for (const log of activities) {
      eventsByType[log.action] = (eventsByType[log.action] || 0) + 1;
    }
    return {
      payrollRunId,
      totalEvents: activities.length,
      eventsByType,
      timeline: activities,
      generatedAt: new Date(),
    };
  }
}
