import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ConversationsListResponse } from '@slack/web-api';
import { ChannelType } from 'src/common/enums';
import type { ChannelInfo, IPlatformClient } from 'src/common/interfaces';
import { SlackClient } from '../clients/slack.client';
import { IntegrationChannel } from '../entities/integration-channel.entity';
import type { PlatformIntegration } from '../entities/platform-integration.entity';
import type { ShoutoutBroadcast } from '../integration.types';
import type { IntegrationChannelRepository } from '../repositories/integration-channel.repository';
import type { PlatformIntegrationRepository } from '../repositories/platform-integration.repository';

@Injectable()
export class ChannelManagementService {
  constructor(
    private readonly channelRepo: IntegrationChannelRepository,
    private readonly integrationRepo: PlatformIntegrationRepository,
  ) {}
  async getAvailableChannels(
    integrationId: string,
    userAccessToken?: string,
  ): Promise<ChannelInfo[]> {
    const integration = await this.integrationRepo.findOne({
      where: { id: integrationId },
    });
    if (!integration) {
      throw new NotFoundException('Integration not found');
    }
    const client = this.createClientWithUserToken(integration, userAccessToken);
    switch (integration.type) {
      case 'slack': {
        const slackChannels = await this.getSlackChannels(client as SlackClient);
        for (const ch of slackChannels.filter((c) => c.type === 'private')) {
          try {
            await (client as SlackClient).client.conversations.join({ channel: ch.id });
          } catch (_err) {}
        }
        return slackChannels;
      }
      default:
        throw new BadRequestException(`Channel listing not supported for ${integration.type}`);
    }
  }
  async configureShoutoutChannel(
    integrationId: string,
    platformChannelId: string,
    platformChannelName: string,
    createdBy: string,
    userAccessToken?: string,
  ) {
    const channelConfig = {
      platformChannelId,
      platformChannelName,
      channelType: ChannelType.SHOUTOUTS,
      isPrimary: true,
    };
    return this.configureChannel(integrationId, channelConfig, createdBy);
  }
  async configureChannel(
    integrationId: string,
    channelConfig: {
      platformChannelId: string;
      platformChannelName: string;
      channelType: ChannelType;
      isPrimary?: boolean;
      teamId?: string;
      departmentId?: string;
      categoryFilter?: string[];
      minPointsThreshold?: number;
    },
    createdBy: string,
  ) {
    if (channelConfig.isPrimary) {
      await this.channelRepo
        .createQueryBuilder()
        .update(IntegrationChannel)
        .set({ isPrimary: false })
        .where({ integrationId, isPrimary: true })
        .execute();
    }
    const channel = {
      integrationId,
      ...channelConfig,
      createdBy,
    };
    return this.channelRepo.create(channel);
  }
  async getConfiguredChannels(integrationId: string) {
    return this.channelRepo.find({
      where: { integrationId, isActive: true },
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });
  }
  async determineTargetChannels(
    integrationId: string,
    shoutout: ShoutoutBroadcast,
  ): Promise<IntegrationChannel[]> {
    const allChannels = await this.getConfiguredChannels(integrationId);
    if (allChannels.length === 0) {
      return [];
    }
    const eligibleChannels = allChannels.filter((channel) => {
      if (shoutout.total_points < channel.minPointsThreshold) {
        return false;
      }
      if (channel.categoryFilter && channel.categoryFilter.length > 0) {
        if (!shoutout.category?.id || !channel.categoryFilter.includes(shoutout.category.id)) {
          return false;
        }
      }
      if (channel.teamId && !this.isShoutoutForTeam(shoutout, channel.teamId)) {
        return false;
      }
      if (channel.departmentId && !this.isShoutoutForDepartment(shoutout, channel.departmentId)) {
        return false;
      }
      return true;
    });
    if (eligibleChannels.length === 0) {
      const primaryChannel = allChannels.find((c) => c.isPrimary);
      return primaryChannel ? [primaryChannel] : [];
    }
    return eligibleChannels;
  }
  private createClientWithUserToken(
    integration: PlatformIntegration,
    userAccessToken?: string,
  ): IPlatformClient {
    const token = userAccessToken || integration.botToken;
    switch (integration.type) {
      case 'slack':
        return new SlackClient(token);
      default:
        throw new BadRequestException(`Unsupported platform: ${integration.type}`);
    }
  }
  private async getSlackChannels(client: SlackClient): Promise<ChannelInfo[]> {
    try {
      const response: ConversationsListResponse = await client.client.conversations.list({
        types: 'public_channel,private_channel',
        exclude_archived: true,
        limit: 100,
      });
      return (
        response.channels?.map((channel) => ({
          id: channel.id ?? '',
          name: channel.name ?? '',
          type: channel.is_private ? ('private' as const) : ('public' as const),
          memberCount: channel.num_members,
          description: channel.purpose?.value || channel.topic?.value,
        })) || []
      );
    } catch (_error) {
      return [];
    }
  }
  private isShoutoutForTeam(shoutout: ShoutoutBroadcast, teamId: string): boolean {
    return (
      shoutout.recipients.some((r) =>
        r.recipient?.teamMemberships?.some((tm) => tm.teamId === teamId),
      ) || shoutout.creator.teamMemberships?.some((tm) => tm.teamId === teamId) === true
    );
  }
  private isShoutoutForDepartment(shoutout: ShoutoutBroadcast, departmentId: string): boolean {
    return (
      shoutout.recipients.some((r) =>
        r.recipient?.departmentMemberships?.some((dm) => dm.departmentId === departmentId),
      ) ||
      shoutout.creator.departmentMemberships?.some((dm) => dm.departmentId === departmentId) ===
        true
    );
  }
}
