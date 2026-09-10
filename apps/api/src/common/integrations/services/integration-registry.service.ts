import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ChannelType, IntegrationType } from 'src/common/enums';
import { PlatformIntegration } from '../entities/platform-integration.entity';
import type { IntegrationConfig } from '../integration.types';
import { IntegrationChannelRepository } from '../repositories/integration-channel.repository';
import { PlatformIntegrationRepository } from '../repositories/platform-integration.repository';
import { PlatformUserRepository } from '../repositories/platform-user.repository';

@Injectable()
export class IntegrationRegistryService {
  constructor(
    private readonly integrationRepo: PlatformIntegrationRepository,
    private readonly channelRepo: IntegrationChannelRepository,
    private readonly platformUserRepo: PlatformUserRepository,
  ) {}

  async createIntegration(
    tenantId: string,
    type: IntegrationType,
    config: IntegrationConfig,
    memberId: string,
  ) {
    const integrationData = {
      tenantId,
      type,
      platformTeamId: config.teamId,
      platformTeamName: config.teamName,
      accessToken: config.accessToken,
      refreshToken: config.refreshToken,
      botToken: config.botToken,
      webhookUrl: config.webhookUrl,
      expiresAt: config.expiresAt,
    };
    const integration = await this.integrationRepo.save(integrationData);
    const channel = {
      integrationId: integration.id,
      platformChannelId: config.teamId,
      platformChannelName: '#shoutouts',
      channelType: ChannelType.SHOUTOUTS,
      isPrimary: true,
      createdBy: memberId,
    };
    await this.channelRepo.save(channel);
    return integration;
  }

  async getIntegrations(tenantId: string): Promise<PlatformIntegration[]> {
    return this.integrationRepo.find({
      where: { tenantId, isActive: true },
      relations: ['platformUsers'],
    });
  }

  async requireTenantIntegration(
    tenantId: string,
    integrationId: string,
  ): Promise<PlatformIntegration> {
    const integration = await this.integrationRepo.findOne({
      where: { id: integrationId, tenantId },
    });
    if (!integration) {
      throw new NotFoundException('Integration not found');
    }
    return integration;
  }

  async getShoutoutSlackStatus(tenantId: string): Promise<{
    configured: boolean;
    channelName?: string;
    channelNames?: string[];
    configuredChannels?: Array<{ platformChannelId: string; platformChannelName: string }>;
    integrationId?: string;
  }> {
    const integration = await this.integrationRepo.findOne({
      where: { tenantId, isActive: true, type: IntegrationType.SLACK },
    });
    if (!integration) {
      return { configured: false };
    }

    const channels = await this.channelRepo.find({
      where: {
        integrationId: integration.id,
        isActive: true,
        channelType: ChannelType.SHOUTOUTS,
      },
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });

    if (channels.length === 0) {
      return { configured: false, integrationId: integration.id };
    }

    const channelNames = channels.map((channel) => channel.platformChannelName);

    return {
      configured: true,
      channelName: channelNames[0],
      channelNames,
      configuredChannels: channels.map((channel) => ({
        platformChannelId: channel.platformChannelId,
        platformChannelName: channel.platformChannelName,
      })),
      integrationId: integration.id,
    };
  }

  async isShoutoutSlackConfigured(tenantId: string): Promise<boolean> {
    const status = await this.getShoutoutSlackStatus(tenantId);
    return status.configured;
  }

  async disconnectIntegration(tenantId: string, integrationId: string, memberId: string) {
    const integration = await this.integrationRepo.findOne({
      where: { id: integrationId, tenantId },
    });
    if (!integration) {
      throw new BadRequestException('Integration not found');
    }
    await this.integrationRepo.update(integrationId, {
      isActive: false,
    });
    await this.channelRepo
      .createQueryBuilder()
      .update()
      .set({ isActive: false })
      .where('integrationId = :integrationId', { integrationId })
      .execute();
    await this.platformUserRepo
      .createQueryBuilder()
      .update()
      .set({ isActive: false })
      .where('integrationId = :integrationId', { integrationId })
      .execute();
    return {
      success: true,
      message: `${integration.type} integration disconnected successfully`,
      integrationId,
      disconnectedAt: new Date(),
    };
  }

  async reconnectIntegration(tenantId: string, integrationId: string, memberId: string) {
    const integration = await this.integrationRepo.findOne({
      where: { id: integrationId, tenantId },
    });
    if (!integration) {
      throw new BadRequestException('Integration not found');
    }
    await this.integrationRepo.update(integrationId, {
      isActive: true,
    });
    await this.channelRepo
      .createQueryBuilder()
      .update()
      .set({ isActive: true })
      .where('integrationId = :integrationId', { integrationId })
      .execute();
    await this.platformUserRepo
      .createQueryBuilder()
      .update()
      .set({ isActive: true })
      .where('integrationId = :integrationId', { integrationId })
      .execute();
    return {
      success: true,
      message: `${integration.type} integration reconnected successfully`,
      integrationId,
      reconnectedAt: new Date(),
    };
  }

  async getIntegrationStatus(integrationId: string) {
    const integration = await this.integrationRepo.findOne({
      where: { id: integrationId },
      relations: ['channels', 'platformUsers'],
    });
    if (!integration) {
      throw new BadRequestException('Integration not found');
    }
    const activeChannels = integration.channels?.filter((c) => c.isActive) || [];
    const activePlatformUsers = integration.platformUsers?.filter((u) => u.isActive) || [];
    return {
      integration: {
        id: integration.id,
        type: integration.type,
        teamName: integration.platformTeamName,
        isActive: integration.isActive,
        createdAt: integration.createdAt,
      },
      channels: {
        total: integration.channels?.length || 0,
        active: activeChannels.length,
        primary: activeChannels.find((c) => c.isPrimary),
      },
      users: {
        total: integration.platformUsers?.length || 0,
        active: activePlatformUsers.length,
        matched: activePlatformUsers.filter((u) => u.tenantMemberId).length,
      },
      lastSyncAt: integration.createdAt,
    };
  }

  async getActiveChannelsForIntegration(integrationId: string) {
    return this.channelRepo.find({
      where: { integrationId, isActive: true },
    });
  }
}
