import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { type ConversationsListResponse, ErrorCode } from '@slack/web-api';
import type { ChannelInfo } from 'src/common/interfaces';
import { SlackClient } from '../clients/slack.client';
import { IntegrationChannel } from '../entities/integration-channel.entity';
import { IntegrationChannelRepository } from '../repositories/integration-channel.repository';
import { PlatformIntegrationRepository } from '../repositories/platform-integration.repository';

@Injectable()
export class ChannelListingService {
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

  async configureChannel(
    integrationId: string,
    channelConfig: {
      platformChannelId: string;
      platformChannelName: string;
      channelType: import('src/common/enums').ChannelType;
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
    return this.channelRepo.save(channel);
  }

  async getConfiguredChannels(integrationId: string) {
    return this.channelRepo.find({
      where: { integrationId, isActive: true },
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });
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

  formatChannelDisplayName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) return '#channel';
    return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  }
}
