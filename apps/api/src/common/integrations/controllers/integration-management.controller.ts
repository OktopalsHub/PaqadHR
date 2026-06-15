import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember, TenantId } from 'src/common/decorators';
import type { MemberContext } from 'src/common/interfaces';
import { TenantMemberGuard } from '../../../modules/v1/tenant-members/guards/tenant-members.guards';
import type { IntegrationSetupService } from '../services/integration-setup.service';
import type { UserSyncService } from '../services/user-sync.service';
@ApiTags('Integration Management')
@UseGuards(TenantMemberGuard)
@Controller('tenants/:tenantId/integrations')
export class IntegrationManagementController {
  constructor(
    private readonly integrationSetupService: IntegrationSetupService,
    private readonly userSyncService: UserSyncService,
  ) {}
  @Post(':integrationId/sync-users')
  async triggerUserSync(
    @TenantId() tenantId: string,
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
  ) {
    return this.integrationSetupService.triggerUserSync(integrationId, tenantId);
  }
  @Get(':integrationId/sync-status')
  async getSyncStatus(@Param('integrationId', ParseUUIDPipe) integrationId: string) {
    return this.integrationSetupService.getIntegrationStatus(integrationId);
  }
  @Get(':integrationId/unmatched-users')
  async getUnmatchedUsers(@Param('integrationId', ParseUUIDPipe) integrationId: string) {
    return this.userSyncService.getUnmatchedUsers(integrationId);
  }
  @Post(':integrationId/match-user')
  async matchUser(
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
    @Body()
    matchData: {
      platformUserId: string;
      tenantMemberId: string;
    },
  ) {
    return this.userSyncService.manualUserMatch(
      integrationId,
      matchData.platformUserId,
      matchData.tenantMemberId,
    );
  }
  @Post(':integrationId/bulk-invite')
  async bulkInviteUsers(
    @TenantId() tenantId: string,
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.userSyncService.bulkInviteUnmatchedUsers(integrationId, tenantId, member.id);
  }
}
