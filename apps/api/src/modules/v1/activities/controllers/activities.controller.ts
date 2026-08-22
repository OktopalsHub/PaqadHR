import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember } from 'src/common/decorators/tenant-member.decorator';
import type { MemberContext } from 'src/common/interfaces';
import { isTenantAdmin } from 'src/common/utils/member-access.util';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import { ActivitiesService } from '../services/activities.service';

@ApiTags('Activities')
@Controller('tenants/:tenantId/activities')
@UseGuards(TenantMemberGuard)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  @ApiOperation({ summary: 'List tenant activity log (full for admins, mild for members)' })
  async list(
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('resourceType') resourceType?: string,
    @Query('action') action?: string,
    @Query('resourceId') resourceId?: string,
  ) {
    const admin = isTenantAdmin(member);
    return this.activitiesService.listForTenant(tenantId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      resourceType: admin ? resourceType : undefined,
      action: admin ? action : undefined,
      resourceId: admin ? resourceId : undefined,
      mildOnly: !admin,
      actorMemberId: admin ? undefined : member.id,
    });
  }
}
