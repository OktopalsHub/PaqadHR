import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireFeatures } from 'src/common/decorators';
import { FeatureAccess } from 'src/common/enums/subscription.enum';
import { FeatureAccessGuard } from 'src/common/guards/feature-access.guard';
import { TenantMemberGuard } from '../tenant-members/guards/tenant-members.guards';
import { AnalyticsService } from './analytics.service';
import type { AnalyticsOverviewDto } from './dto/analytics-overview.dto';

@ApiTags('Analytics')
@Controller('tenants/:tenantId/analytics')
@UseGuards(TenantMemberGuard, FeatureAccessGuard)
@RequireFeatures(FeatureAccess.ADVANCED_REPORTING)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get workspace analytics overview' })
  async getOverview(@Param('tenantId') tenantId: string): Promise<AnalyticsOverviewDto> {
    return this.analyticsService.getOverview(tenantId);
  }
}
