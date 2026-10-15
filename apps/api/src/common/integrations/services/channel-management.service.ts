import { Injectable } from '@nestjs/common';
import { ChannelType } from 'src/common/enums';
import type { ChannelInfo } from 'src/common/interfaces';
import { IntegrationChannel } from '../entities/integration-channel.entity';
import type { ShoutoutBroadcast } from '../integration.types';
import { ChannelListingService } from './channel-listing.service';
import type {
  ConfigureShoutoutChannelsResult,
  ShoutoutChannelSetupInput,
} from './shoutout-channel.service';
import { ShoutoutChannelService } from './shoutout-channel.service';

@Injectable()
export class ChannelManagementService {
  constructor(
    private readonly channelListingService: ChannelListingService,
    private readonly shoutoutChannelService: ShoutoutChannelService,
  ) {}

  async getAvailableChannels(integrationId: string): Promise<ChannelInfo[]> {
    return this.channelListingService.getAvailableChannels(integrationId);
  }

  async configureShoutoutChannel(
    integrationId: string,
    platformChannelId: string,
    platformChannelName: string,
    createdBy: string,
    _userAccessToken?: string,
  ) {
    return this.shoutoutChannelService.configureShoutoutChannel(
      integrationId,
      platformChannelId,
      platformChannelName,
      createdBy,
    );
  }

  async configureShoutoutChannels(
    integrationId: string,
    channels: ShoutoutChannelSetupInput[],
    createdBy: string,
  ): Promise<ConfigureShoutoutChannelsResult> {
    return this.shoutoutChannelService.configureShoutoutChannels(
      integrationId,
      channels,
      createdBy,
    );
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
    return this.channelListingService.configureChannel(integrationId, channelConfig, createdBy);
  }

  async getConfiguredChannels(integrationId: string) {
    return this.channelListingService.getConfiguredChannels(integrationId);
  }

  async determineTargetChannels(
    integrationId: string,
    shoutout: ShoutoutBroadcast,
  ): Promise<IntegrationChannel[]> {
    return this.shoutoutChannelService.determineTargetChannels(integrationId, shoutout);
  }

  async createSlackChannel(integrationId: string, rawName: string): Promise<ChannelInfo> {
    return this.channelListingService.createSlackChannel(integrationId, rawName);
  }
}
