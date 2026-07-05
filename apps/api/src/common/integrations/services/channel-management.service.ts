import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { type ConversationsListResponse, ErrorCode } from '@slack/web-api';
import { ChannelType } from 'src/common/enums';
import type { ChannelInfo } from 'src/common/interfaces';
import { SlackClient } from '../clients/slack.client';
import { IntegrationChannel } from '../entities/integration-channel.entity';
import type { ShoutoutBroadcast } from '../integration.types';
import { IntegrationChannelRepository } from '../repositories/integration-channel.repository';
import { PlatformIntegrationRepository } from '../repositories/platform-integration.repository';

@Injectable()
export class ChannelManagementService {
  constructor(
    private readonly channelRepo: IntegrationChannelRepository,
    private readonly integrationRepo: PlatformIntegrationRepository,
  ) {}
  async getAvailableChannels(integrationId: string): Promise<ChannelInfo[]> {
    const integration = await this.integrationRepo.findOne({
      where: { id: integrationId },
    });
    if (!integration) {
      throw new NotFoundException('Integration not found');
    }
    switch (integration.type) {
      case 'slack': {
        if (!integration.botToken) {
          throw new BadRequestException('Slack bot token is missing. Reconnect Slack.');
        }
        const client = new SlackClient(integration.botToken);
        const slackChannels = await this.getSlackChannels(client);
        for (const ch of slackChannels.filter((c) => c.type === 'private')) {
          try {
            await client.client.conversations.join({ channel: ch.id });
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
    const channel = await this.configureChannel(
      integrationId,
      {
        platformChannelId,
        platformChannelName,
        channelType: ChannelType.SHOUTOUTS,
        isPrimary: true,
      },
      createdBy,
    );

    const integration = await this.integrationRepo.findOne({ where: { id: integrationId } });
    if (!integration?.botToken) {
      return {
        channel,
        testMessageSent: false,
        testMessageError: 'Slack bot token is missing for this integration',
      };
    }

    try {
      const client = new SlackClient(integration.botToken);
      await client.sendMessage(
        platformChannelId,
        "Shoutouts from PaqadHR will be posted here. You're all set!",
      );
      return { channel, testMessageSent: true };
    } catch (error) {
      return {
        channel,
        testMessageSent: false,
        testMessageError: error instanceof Error ? error.message : 'Failed to post test message',
      };
    }
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
  async createSlackChannel(integrationId: string, rawName: string): Promise<ChannelInfo> {
    const integration = await this.integrationRepo.findOne({ where: { id: integrationId } });
    if (!integration) {
      throw new NotFoundException('Integration not found');
    }
    if (!integration.botToken) {
      throw new BadRequestException('Slack bot token is missing. Reconnect Slack.');
    }

    const name = rawName
      .trim()
      .replace(/^#/, '')
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (!name) {
      throw new BadRequestException('Channel name is required');
    }

    const client = new SlackClient(integration.botToken);
    const response = await client.client.conversations.create({ name, is_private: false });
    if (!response.ok || !response.channel?.id) {
      throw new BadRequestException(
        `Slack could not create the channel: ${response.error ?? 'unknown error'}`,
      );
    }

    return {
      id: response.channel.id,
      name: response.channel.name ?? name,
      type: 'public',
      description: response.channel.purpose?.value || response.channel.topic?.value,
    };
  }

  private async getSlackChannels(client: SlackClient): Promise<ChannelInfo[]> {
    const channels: ChannelInfo[] = [];
    let cursor: string | undefined;

    try {
      do {
        const response: ConversationsListResponse = await client.client.conversations.list({
          types: 'public_channel,private_channel',
          exclude_archived: true,
          limit: 200,
          cursor,
        });
        if (!response.ok) {
          throw new BadRequestException(
            `Slack could not list channels: ${response.error ?? 'unknown error'}`,
          );
        }
        for (const channel of response.channels ?? []) {
          channels.push({
            id: channel.id ?? '',
            name: channel.name ?? '',
            type: channel.is_private ? ('private' as const) : ('public' as const),
            memberCount: channel.num_members,
            description: channel.purpose?.value || channel.topic?.value,
          });
        }
        cursor = response.response_metadata?.next_cursor || undefined;
      } while (cursor);
    } catch (err) {
      this.throwSlackError(err);
    }

    return channels;
  }

  private throwSlackError(err: unknown): never {
    if (err instanceof BadRequestException) {
      throw err;
    }

    const slackError = this.getSlackErrorCode(err);
    if (slackError) {
      const reconnectErrors = new Set([
        'invalid_auth',
        'token_revoked',
        'account_inactive',
        'missing_scope',
        'not_authed',
      ]);
      if (reconnectErrors.has(slackError)) {
        const needed = this.getSlackNeededScope(err);
        const detail = needed ? `${slackError}: ${needed}` : slackError;
        throw new BadRequestException(`Slack authorization failed (${detail}). Reconnect Slack.`);
      }
      throw new BadRequestException(`Slack could not list channels: ${slackError}`);
    }

    if (err instanceof Error) {
      throw new BadRequestException(`Slack could not list channels: ${err.message}`);
    }

    throw err;
  }

  private getSlackErrorCode(err: unknown): string | undefined {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === ErrorCode.PlatformError &&
      'data' in err
    ) {
      return (err as { data?: { error?: string } }).data?.error;
    }
    return undefined;
  }

  private getSlackNeededScope(err: unknown): string | undefined {
    if (
      typeof err === 'object' &&
      err !== null &&
      'data' in err &&
      typeof (err as { data?: { needed?: string } }).data?.needed === 'string'
    ) {
      return (err as { data: { needed: string } }).data.needed;
    }
    return undefined;
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
