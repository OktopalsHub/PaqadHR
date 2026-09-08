import { BadRequestException, Injectable } from '@nestjs/common';
import { ChannelType } from 'src/common/enums';
import { In, Not } from 'typeorm';
import { SlackClient } from '../clients/slack.client';
import { IntegrationChannel } from '../entities/integration-channel.entity';
import type { ShoutoutBroadcast } from '../integration.types';
import { IntegrationChannelRepository } from '../repositories/integration-channel.repository';
import { PlatformIntegrationRepository } from '../repositories/platform-integration.repository';

const SHOUTOUT_TEST_MESSAGE = "Shoutouts from PaqadHR will be posted here. You're all set!";
const SLACK_BOT_NAME = 'PaqadHR';

export type ShoutoutChannelSetupInput = {
  platformChannelId: string;
  platformChannelName: string;
};

export type ShoutoutChannelSetupResult = {
  channel: IntegrationChannel;
  channelId: string;
  channelName: string;
  testMessageSent: boolean;
  testMessageError?: string;
  needsInvite?: boolean;
};

export type ConfigureShoutoutChannelsResult = {
  channels: ShoutoutChannelSetupResult[];
  allTestsPassed: boolean;
  inviteRequired: string[];
};

@Injectable()
export class ShoutoutChannelService {
  constructor(
    private readonly channelRepo: IntegrationChannelRepository,
    private readonly integrationRepo: PlatformIntegrationRepository,
  ) {}

  async configureShoutoutChannel(
    integrationId: string,
    platformChannelId: string,
    platformChannelName: string,
    createdBy: string,
    _userAccessToken?: string,
  ) {
    const result = await this.configureShoutoutChannels(
      integrationId,
      [{ platformChannelId, platformChannelName }],
      createdBy,
    );
    return result.channels[0];
  }

  async configureShoutoutChannels(
    integrationId: string,
    channels: ShoutoutChannelSetupInput[],
    createdBy: string,
  ): Promise<ConfigureShoutoutChannelsResult> {
    if (channels.length === 0) {
      throw new BadRequestException('Select at least one Slack channel');
    }

    const selectedIds = channels.map((channel) => channel.platformChannelId);
    await this.deactivateShoutoutChannelsNotInSelection(integrationId, selectedIds);

    const integration = await this.integrationRepo.findOne({ where: { id: integrationId } });
    const results: ShoutoutChannelSetupResult[] = [];

    for (let index = 0; index < channels.length; index++) {
      const input = channels[index];
      const channel = await this.upsertShoutoutChannel(
        integrationId,
        input.platformChannelId,
        input.platformChannelName,
        createdBy,
        index === 0,
      );
      const testResult = await this.sendShoutoutTestMessage(
        integration,
        input.platformChannelId,
        input.platformChannelName,
      );
      results.push({
        channel,
        channelId: input.platformChannelId,
        channelName: this.formatChannelDisplayName(input.platformChannelName),
        ...testResult,
      });
    }

    const inviteRequired = results
      .filter((result) => result.needsInvite)
      .map((result) => result.channelName);

    return {
      channels: results,
      allTestsPassed: results.every((result) => result.testMessageSent),
      inviteRequired,
    };
  }

  async determineTargetChannels(
    integrationId: string,
    shoutout: ShoutoutBroadcast,
  ): Promise<IntegrationChannel[]> {
    const allChannels = await this.channelRepo.find({
      where: { integrationId, isActive: true },
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });
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

  private async upsertShoutoutChannel(
    integrationId: string,
    platformChannelId: string,
    platformChannelName: string,
    createdBy: string,
    isPrimary: boolean,
  ): Promise<IntegrationChannel> {
    if (isPrimary) {
      await this.channelRepo
        .createQueryBuilder()
        .update(IntegrationChannel)
        .set({ isPrimary: false })
        .where({ integrationId, isPrimary: true })
        .execute();
    }

    const existing = await this.channelRepo.findOne({
      where: {
        integrationId,
        platformChannelId,
        channelType: ChannelType.SHOUTOUTS,
      },
    });

    if (existing) {
      await this.channelRepo.update(existing.id, {
        platformChannelName,
        isActive: true,
        isPrimary,
      });
      return (await this.channelRepo.findOne({ where: { id: existing.id } })) ?? existing;
    }

    return this.channelRepo.save({
      integrationId,
      platformChannelId,
      platformChannelName,
      channelType: ChannelType.SHOUTOUTS,
      isPrimary,
      createdBy,
    });
  }

  private async deactivateShoutoutChannelsNotInSelection(
    integrationId: string,
    selectedPlatformChannelIds: string[],
  ): Promise<void> {
    await this.channelRepo.update(
      {
        integrationId,
        channelType: ChannelType.SHOUTOUTS,
        platformChannelId: Not(In(selectedPlatformChannelIds)),
        isActive: true,
      },
      { isActive: false, isPrimary: false },
    );
  }

  private async sendShoutoutTestMessage(
    integration: { botToken?: string | null } | null,
    platformChannelId: string,
    platformChannelName: string,
  ): Promise<
    Pick<ShoutoutChannelSetupResult, 'testMessageSent' | 'testMessageError' | 'needsInvite'>
  > {
    if (!integration?.botToken) {
      return {
        testMessageSent: false,
        testMessageError: 'Slack bot token is missing for this integration',
      };
    }

    const client = new SlackClient(integration.botToken);
    await this.joinSlackChannel(client, platformChannelId);

    try {
      await client.sendMessage(platformChannelId, SHOUTOUT_TEST_MESSAGE);
      return { testMessageSent: true };
    } catch (error) {
      const mapped = this.mapSlackPostError(error, platformChannelName);
      return {
        testMessageSent: false,
        testMessageError: mapped.message,
        needsInvite: mapped.needsInvite,
      };
    }
  }

  private async joinSlackChannel(client: SlackClient, channelId: string): Promise<void> {
    try {
      await client.client.conversations.join({ channel: channelId });
    } catch (err) {
      const code = this.getSlackErrorCode(err);
      if (code === 'already_in_channel') {
        return;
      }
    }
  }

  private mapSlackPostError(
    err: unknown,
    platformChannelName: string,
  ): { message: string; needsInvite: boolean; code?: string } {
    const slackError = this.getSlackErrorCode(err);
    const channelName = this.formatChannelDisplayName(platformChannelName);

    if (slackError === 'not_in_channel' || slackError === 'channel_not_found') {
      return {
        code: 'bot_not_in_channel',
        needsInvite: true,
        message: `Shoutouts can't post to ${channelName} until the ${SLACK_BOT_NAME} bot is invited. In Slack, open the channel and run \`/invite @${SLACK_BOT_NAME}\`, then refresh.`,
      };
    }

    if (err instanceof Error) {
      return { message: err.message, needsInvite: false };
    }

    return { message: 'Failed to post test message', needsInvite: false };
  }

  private getSlackErrorCode(err: unknown): string | undefined {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'platform_error' &&
      'data' in err
    ) {
      return (err as { data?: { error?: string } }).data?.error;
    }
    return undefined;
  }

  private formatChannelDisplayName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) return '#channel';
    return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
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
