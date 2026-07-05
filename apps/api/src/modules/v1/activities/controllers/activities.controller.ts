import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantMemberRole } from 'src/common/enums';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import { ActivitiesService } from '../services/activities.service';

@ApiTags('Activities')
@Controller('tenants/:tenantId/activities')
@UseGuards(TenantMemberGuard, TenantRoleGuard)
@Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  @ApiOperation({ summary: 'List tenant activity log (tenant-scoped only)' })
  async list(
    @Param('tenantId') tenantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('resourceType') resourceType?: string,
    @Query('action') action?: string,
    @Query('resourceId') resourceId?: string,
  ) {
    return this.activitiesService.listForTenant(tenantId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      resourceType,
      action,
      resourceId,
    });
  }
}
