import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ChannelType, IntegrationType, TenantMemberRole } from 'src/common/enums';
import { IPlatformClient } from 'src/common/interfaces';
import { In } from 'typeorm';
import { TenantMembersService } from '../../../modules/v1/tenant-members/tenant-members.service';
import { SlackClient } from '../clients/slack.client';
import type { PlatformIntegration } from '../entities/platform-integration.entity';
import { PlatformUser } from '../entities/platform-user.entity';
import type {
  IntegrationConfig,
  PlatformUserData,
  PlatformUserSaveData,
  ShoutoutBroadcast,
} from '../integration.types';
import { IntegrationChannelRepository } from '../repositories/integration-channel.repository';
import { PlatformIntegrationRepository } from '../repositories/platform-integration.repository';
import { PlatformUserRepository } from '../repositories/platform-user.repository';
import { UserSyncService } from './user-sync.service';

@Injectable()
export class PlatformIntegrationService {
  constructor(
    private readonly integrationRepo: PlatformIntegrationRepository,
    private readonly platformUserRepo: PlatformUserRepository,
    private readonly channelRepo: IntegrationChannelRepository,
    private readonly tenantMembersService: TenantMembersService,
    private readonly userSyncService: UserSyncService,
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

  async syncUsers(integrationId: string, channelId?: string) {
    const integration = await this.integrationRepo.findOne({
      where: { id: integrationId },
    });
    if (!integration) {
      throw new BadRequestException('Integration not found');
    }
    const client = this.createClient(integration);
    let users: PlatformUserData[] = [];
    if (channelId) {
      users = await client.getChannelMembers(channelId);
    } else {
      users = (await client.listUsers()) as PlatformUserData[];
    }
    for (const user of users) {
      await this.upsertPlatformUser(integration.id, user);
    }
  }
  @OnEvent('shoutout.created')
  async handleShoutoutCreated(event: {
    tenantId: string;
    shoutout: ShoutoutBroadcast;
  }): Promise<void> {
    await this.broadcastShoutout(event.tenantId, event.shoutout);
  }

  async broadcastShoutout(tenantId: string, shoutout: ShoutoutBroadcast) {
    const integrations = await this.getIntegrations(tenantId);
    const promises = integrations.map(async (integration) => {
      try {
        const client = this.createClient(integration);
        const message = await this.formatShoutoutMessage(client, shoutout, integration.id);
        const channels = await this.channelRepo.find({
          where: {
            integrationId: integration.id,
            isActive: true,
          },
        });
        for (const channel of channels) {
          await client.sendMessage(channel.platformChannelId, message);
        }
      } catch (_error) {}
    });
    await Promise.allSettled(promises);
  }
  private createClient(integration: PlatformIntegration): IPlatformClient {
    switch (integration.type) {
      case IntegrationType.SLACK:
        return new SlackClient(integration.botToken);
      default:
        throw new BadRequestException(`Unsupported integration type: ${integration.type}`);
    }
  }
  private async upsertPlatformUser(integrationId: string, platformUserData: PlatformUserData) {
    const existingUser = await this.platformUserRepo.findOne({
      where: {
        integrationId,
        platformUserId: platformUserData.id,
      },
    });
    let tenantMemberId: string | null = null;
    if (platformUserData.email) {
      try {
        const tenantMember = await this.tenantMembersService.findByEmail(platformUserData.email);
        if (tenantMember) {
          tenantMemberId = tenantMember.id;
        }
      } catch (_error) {}
    }
    const platformUserDataToSave: PlatformUserSaveData = {
      integrationId,
      platformUserId: platformUserData.id,
      platformUsername: platformUserData.username,
      platformDisplayName: platformUserData.displayName,
      platformEmail: platformUserData.email,
      platformAvatarUrl: platformUserData.avatarUrl,
    };
    if (tenantMemberId !== null) {
      platformUserDataToSave.tenantMemberId = tenantMemberId;
    }
    if (existingUser) {
      await this.platformUserRepo.update(existingUser.id, platformUserDataToSave);
      return this.platformUserRepo.findOne({ where: { id: existingUser.id } });
    }
    return this.platformUserRepo.save(platformUserDataToSave);
  }
  private async formatShoutoutMessage(
    client: IPlatformClient,
    shoutout: ShoutoutBroadcast,
    integrationId: string,
  ): Promise<string> {
    const participantIds = [
      shoutout.creator.tenantMemberId,
      ...shoutout.recipients.map((r) => r.tenantMemberId),
    ];
    const platformUsers = await this.platformUserRepo.find({
      where: {
        integrationId,
        tenantMemberId: In(participantIds.filter(Boolean)),
      },
    });
    const getMention = (tenantMemberId: string) => {
      const pu = platformUsers.find((p) => p.tenantMemberId === tenantMemberId);
      if (!pu) return 'Someone';
      if (client instanceof SlackClient)
        return `<@${pu.platformUserId}> (${pu.platformDisplayName})`;
      return `@${pu.platformDisplayName || pu.platformUsername}`;
    };
    let message = `*Shoutout!*\n`;
    message += `${getMention(shoutout.creator.tenantMemberId)} gave kudos to `;
    message += `${shoutout.recipients.map((r) => getMention(r.tenantMemberId)).join(', ')}!\n`;
    message += `> ${shoutout.message}\n(${shoutout.total_points} points)`;
    return message;
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
    await this.syncUsers(integrationId);
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
  async getUnmatchedUsers(integrationId: string) {
    return this.userSyncService.getUnmatchedUsers(integrationId);
  }
  async getSyncStatus(integrationId: string) {
    return this.userSyncService.getSyncStatus(integrationId);
  }
  async bulkInviteUnmatchedUsers(
    integrationId: string,
    tenantId: string,
    invitedBy: string,
    userIds?: string[],
    sendWelcomeEmail: boolean = true,
  ) {
    let usersToInvite: PlatformUser[];
    if (userIds && userIds.length > 0) {
      const unmatchedUsers = await this.userSyncService.getUnmatchedUsers(integrationId);
      usersToInvite = unmatchedUsers.filter((user) => userIds.includes(user.platformUserId));
    } else {
      usersToInvite = await this.userSyncService.getUnmatchedUsers(integrationId);
    }
    const inviteResults = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
      invitedUsers: [] as unknown[],
    };
    for (const platformUser of usersToInvite) {
      try {
        if (platformUser.platformEmail) {
          const invitation = await this.tenantMembersService.inviteMember(
            tenantId,
            {
              email: platformUser.platformEmail,
              firstName: platformUser.platformDisplayName?.split(' ')[0] || 'User',
              lastName: platformUser.platformDisplayName?.split(' ').slice(1).join(' ') || '',
              role: TenantMemberRole.MEMBER,
              sendWelcomeEmail,
            },
            invitedBy,
          );
          inviteResults.sent++;
          inviteResults.invitedUsers.push({
            platformUserId: platformUser.platformUserId,
            email: platformUser.platformEmail,
            displayName: platformUser.platformDisplayName,
            invitationId: invitation.id,
          });
        } else {
          inviteResults.failed++;
          inviteResults.errors.push(`${platformUser.platformUsername}: No email address available`);
        }
      } catch (error) {
        inviteResults.failed++;
        inviteResults.errors.push(
          `${platformUser.platformEmail || platformUser.platformUsername}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return {
      success: true,
      message: `Bulk invite completed. ${inviteResults.sent} invitations sent, ${inviteResults.failed} failed.`,
      results: inviteResults,
    };
  }
  async manualUserMatch(integrationId: string, platformUserId: string, tenantMemberId: string) {
    return this.userSyncService.manualUserMatch(integrationId, platformUserId, tenantMemberId);
  }
}
