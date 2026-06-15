import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentTenantMember } from 'src/common/decorators';
import type { IntegrationType } from 'src/common/enums';
import type { MemberContext } from 'src/common/interfaces';
import { TenantMemberGuard } from '../../../modules/v1/tenant-members/guards/tenant-members.guards';
import type { IntegrationConfig } from '../integration.types';
import type { PlatformIntegrationService } from '../services/platform-integration.service';

@Controller('tenants/:tenantId/integrations')
@UseGuards(TenantMemberGuard)
export class IntegrationController {
  constructor(private readonly integrationService: PlatformIntegrationService) {}

  @Post('/:type')
  async createIntegration(
    @Param('tenantId') tenantId: string,
    @Param('type') type: IntegrationType,
    @Body() config: IntegrationConfig,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.integrationService.createIntegration(tenantId, type, config, member.id);
  }

  @Get()
  async getIntegrations(@Param('tenantId') tenantId: string) {
    return this.integrationService.getIntegrations(tenantId);
  }

  @Post('/:id/sync-users')
  async syncUsers(@Param('id') integrationId: string, @Body() body: { channelId?: string }) {
    return this.integrationService.syncUsers(integrationId, body.channelId);
  }

  @Post('/:id/disconnect')
  async disconnectIntegration(
    @Param('tenantId') tenantId: string,
    @Param('id') integrationId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.integrationService.disconnectIntegration(tenantId, integrationId, member.id);
  }

  @Post('/:id/reconnect')
  async reconnectIntegration(
    @Param('tenantId') tenantId: string,
    @Param('id') integrationId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.integrationService.reconnectIntegration(tenantId, integrationId, member.id);
  }

  @Get('/:id/unmatched-users')
  async getUnmatchedUsers(@Param('tenantId') tenantId: string, @Param('id') integrationId: string) {
    return this.integrationService.getUnmatchedUsers(integrationId);
  }

  @Get('/:id/sync-status')
  async getSyncStatus(@Param('tenantId') tenantId: string, @Param('id') integrationId: string) {
    return this.integrationService.getSyncStatus(integrationId);
  }

  @Post('/:id/bulk-invite-unmatched')
  async bulkInviteUnmatchedUsers(
    @Param('tenantId') tenantId: string,
    @Param('id') integrationId: string,
    @Body()
    body: {
      userIds?: string[];
      sendWelcomeEmail?: boolean;
    },
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.integrationService.bulkInviteUnmatchedUsers(
      integrationId,
      tenantId,
      member.id,
      body.userIds,
      body.sendWelcomeEmail,
    );
  }

  @Post('/:id/manual-match-user')
  async manualMatchUser(
    @Param('tenantId') tenantId: string,
    @Param('id') integrationId: string,
    @Body()
    body: {
      platformUserId: string;
      tenantMemberId: string;
    },
  ) {
    return this.integrationService.manualUserMatch(
      integrationId,
      body.platformUserId,
      body.tenantMemberId,
    );
  }
}
