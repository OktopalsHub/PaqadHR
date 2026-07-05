import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Redirect,
  Req,
  UseGuards,
  VERSION_NEUTRAL,
  Version,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Request } from 'express';
import { ENVIRONMENT } from 'src/common/config/env.config';
import { Public } from 'src/common/decorators';
import { IntegrationType } from 'src/common/enums';
import type { IAuthenticatedMemberRequest } from 'src/common/interfaces';
import { TenantMemberGuard } from '../../../modules/v1/tenant-members/guards/tenant-members.guards';
import { TenantsService } from '../../../modules/v1/tenants/tenants.service';
import type { OAuthStateData } from '../integration.types';
import { ChannelManagementService } from '../services/channel-management.service';
import { OAuthIntegrationService } from '../services/oauth-integration.service';
import { PlatformIntegrationService } from '../services/platform-integration.service';
import { UserSyncService } from '../services/user-sync.service';

@Controller()
export class OAuthIntegrationController {
  private readonly logger = new Logger(OAuthIntegrationController.name);
  constructor(
    private readonly oauthService: OAuthIntegrationService,
    private readonly channelService: ChannelManagementService,
    private readonly tenantService: TenantsService,
    private readonly integrationService: PlatformIntegrationService,
    private readonly userSyncService: UserSyncService,
    private readonly eventEmitter: EventEmitter2,
  ) {}
  @Get('tenants/:tenantId/integrations/oauth/connect/:platform')
  @UseGuards(TenantMemberGuard)
  async connectPlatform(
    @Param('tenantId') tenantId: string,
    @Param('platform') platform: IntegrationType,
    @Req() request: IAuthenticatedMemberRequest,
  ) {
    const member = request.member;
    const validPlatforms = Object.values(IntegrationType);
    if (!validPlatforms.includes(platform)) {
      throw new BadRequestException(`Invalid platform type: ${platform}`);
    }
    const redirectUri = this.getRedirectUri(request, platform);
    const oauthUrl = this.oauthService.generateOAuthUrl(tenantId, platform, member.id, redirectUri);
    this.logger.debug(`Generated OAuth URL for ${platform}`, {
      platform,
      tenantId,
      userId: member.id,
      ip: request.ip,
    });
    return { url: oauthUrl };
  }
  @Get('integrations/oauth/callback')
  @Version(VERSION_NEUTRAL)
  @Redirect()
  @Public()
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() request: Request,
    @Query('error') error?: string,
  ) {
    this.logger.debug('OAuth callback received', {
      hasCode: !!code,
      hasState: !!state,
      error,
      ip: request.ip,
      userAgent: request.get('user-agent'),
    });
    if (!state || state.length > 2048) {
      this.logger.error('Invalid or missing state parameter', {
        stateLength: state?.length,
        ip: request.ip,
      });
      return {
        url: `${ENVIRONMENT.APP.FRONTEND_URL}?error=invalid_state`,
      };
    }
    let stateData: OAuthStateData;
    try {
      const decodedState = Buffer.from(state, 'base64').toString('utf-8');
      if (decodedState.length > 1024) {
        throw new BadRequestException('State data too large');
      }
      stateData = JSON.parse(decodedState) as OAuthStateData;
      if (!stateData.tenantId || !stateData.platformType || !stateData.tenantMemberId) {
        throw new BadRequestException('Missing required state fields');
      }
      const stateAge = Date.now() - (stateData.timestamp || 0);
      if (stateAge > 600000) {
        throw new BadRequestException('State expired');
      }
      this.logger.debug('State validated successfully', {
        tenantId: stateData.tenantId,
        platform: stateData.platformType,
        age: stateAge,
      });
    } catch (err) {
      this.logger.error('State validation failed', {
        error: err instanceof Error ? err.message : String(err),
        ip: request.ip,
        userAgent: request.get('user-agent'),
      });
      return {
        url: `${ENVIRONMENT.APP.FRONTEND_URL}?error=invalid_state`,
      };
    }
    const { tenantId } = stateData;
    let tenantSlug: string;
    try {
      const tenant = await this.tenantService.getTenant(tenantId);
      tenantSlug = tenant.slug;
    } catch (err) {
      this.logger.error('Failed to get tenant', err);
      return {
        url: `${ENVIRONMENT.APP.FRONTEND_URL}?error=tenant_not_found`,
      };
    }
    const frontendBase = ENVIRONMENT.APP.FRONTEND_URL;
    let baseTarget: string;
    if (process.env.APP_USE_SUBDOMAIN === 'true') {
      baseTarget = `https://${tenantSlug}.${frontendBase}`;
    } else {
      baseTarget = `${frontendBase}/${tenantSlug}`;
    }
    const integrationsSettings = `${baseTarget}/settings?tab=integrations`;
    if (error) {
      this.logger.error('OAuth error', { error });
      return { url: `${integrationsSettings}&error=${error}` };
    }
    if (!code) {
      this.logger.error('No code parameter in callback');
      return { url: `${integrationsSettings}&error=no_code` };
    }
    try {
      this.logger.log('Processing OAuth callback...');
      const result = await this.oauthService.handleOAuthCallback(code, state);
      this.eventEmitter.emit('integration.connected', {
        integrationId: result.integrationId,
        tenantId: stateData.tenantId,
        platform: stateData.platformType,
      });
      this.logger.log('OAuth callback processed successfully', {
        integrationId: result.integrationId,
      });
      return {
        url: `${integrationsSettings}&slack_setup=1&integration_id=${result.integrationId}`,
      };
    } catch (err) {
      this.logger.error('OAuth callback processing failed', err);
      return {
        url: `${integrationsSettings}&error=auth_failed&message=${encodeURIComponent(err instanceof Error ? err.message : String(err))}`,
      };
    }
  }
  @Get('tenants/:tenantId/integrations/:integrationId/channels')
  @UseGuards(TenantMemberGuard)
  async getAvailableChannels(
    @Param('tenantId') tenantId: string,
    @Param('integrationId') integrationId: string,
  ) {
    await this.integrationService.requireTenantIntegration(tenantId, integrationId);
    return this.channelService.getAvailableChannels(integrationId);
  }
  @Post('tenants/:tenantId/integrations/:integrationId/channels/create')
  @UseGuards(TenantMemberGuard)
  async createChannel(
    @Param('tenantId') tenantId: string,
    @Param('integrationId') integrationId: string,
    @Body() body: { name: string },
  ) {
    await this.integrationService.requireTenantIntegration(tenantId, integrationId);
    return this.channelService.createSlackChannel(integrationId, body.name);
  }
  @Post('tenants/:tenantId/integrations/:integrationId/setup-channel')
  @UseGuards(TenantMemberGuard)
  async setupChannel(
    @Param('tenantId') tenantId: string,
    @Param('integrationId') integrationId: string,
    @Body()
    body: {
      platformChannelId: string;
      platformChannelName: string;
    },
    @Req() req: IAuthenticatedMemberRequest,
  ) {
    await this.integrationService.requireTenantIntegration(tenantId, integrationId);
    const member = req.member;
    const userToken = await this.oauthService.getUserToken(integrationId, member.id);
    const result = await this.channelService.configureShoutoutChannel(
      integrationId,
      body.platformChannelId,
      body.platformChannelName,
      member.id,
      userToken?.userAccessToken,
    );
    await this.userSyncService.syncAllUsers(integrationId, tenantId);
    return {
      success: true,
      message: result.testMessageSent
        ? 'Channel configured, users synced, and test message sent!'
        : 'Channel configured and users synced.',
      testMessageSent: result.testMessageSent,
      testMessageError: result.testMessageError,
      needsInvite: result.needsInvite ?? false,
    };
  }

  @Post('tenants/:tenantId/integrations/:integrationId/setup-channels')
  @UseGuards(TenantMemberGuard)
  async setupChannels(
    @Param('tenantId') tenantId: string,
    @Param('integrationId') integrationId: string,
    @Body()
    body: {
      channels: Array<{ platformChannelId: string; platformChannelName: string }>;
    },
    @Req() req: IAuthenticatedMemberRequest,
  ) {
    await this.integrationService.requireTenantIntegration(tenantId, integrationId);
    const member = req.member;
    const result = await this.channelService.configureShoutoutChannels(
      integrationId,
      body.channels ?? [],
      member.id,
    );

    await this.userSyncService.syncAllUsers(integrationId, tenantId);

    return {
      success: true,
      message: result.allTestsPassed
        ? 'Channels configured, users synced, and test messages sent!'
        : 'Channels configured and users synced.',
      allTestsPassed: result.allTestsPassed,
      inviteRequired: result.inviteRequired,
      channels: result.channels.map((channel) => ({
        platformChannelId: channel.channelId,
        platformChannelName: channel.channelName,
        testMessageSent: channel.testMessageSent,
        testMessageError: channel.testMessageError,
        needsInvite: channel.needsInvite ?? false,
      })),
    };
  }
  private getRedirectUri(request: Request, platform: IntegrationType): string {
    const isDevelopment =
      ENVIRONMENT.APP.NODE_ENV === 'development' || request.get('host')?.includes('localhost');
    if (isDevelopment) {
      const protocol = request.get('x-forwarded-proto') || (request.secure ? 'https' : 'http');
      const host = request.get('host');
      return `${protocol}://${host}/integrations/oauth/callback`;
    }
    return `${ENVIRONMENT.APP.BASE_URL}/integrations/oauth/callback`;
  }
}
