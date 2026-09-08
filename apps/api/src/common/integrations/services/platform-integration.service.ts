import { BadRequestException, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IntegrationType, TenantMemberRole } from 'src/common/enums';
import { IPlatformClient } from 'src/common/interfaces';
import { In } from 'typeorm';
import { InvitationsService } from '../../../modules/v1/invitations/invitations.service';
import { TenantMembersService } from '../../../modules/v1/tenant-members/tenant-members.service';
import { SlackClient } from '../clients/slack.client';
import type { PlatformIntegration } from '../entities/platform-integration.entity';
import { PlatformUser } from '../entities/platform-user.entity';
import type { ShoutoutBroadcast } from '../integration.types';
import { PlatformUserRepository } from '../repositories/platform-user.repository';
import { IntegrationRegistryService } from './integration-registry.service';
import { UserSyncService } from './user-sync.service';

@Injectable()
export class PlatformIntegrationService {
  constructor(
    private readonly registryService: IntegrationRegistryService,
    private readonly platformUserRepo: PlatformUserRepository,
    private readonly tenantMembersService: TenantMembersService,
    private readonly invitationsService: InvitationsService,
    private readonly userSyncService: UserSyncService,
  ) {}

  async createIntegration(
    tenantId: string,
    type: IntegrationType,
    config: import('../integration.types').IntegrationConfig,
    memberId: string,
  ) {
    return this.registryService.createIntegration(tenantId, type, config, memberId);
  }

  async getIntegrations(tenantId: string): Promise<PlatformIntegration[]> {
    return this.registryService.getIntegrations(tenantId);
  }

  async requireTenantIntegration(
    tenantId: string,
    integrationId: string,
  ): Promise<PlatformIntegration> {
    return this.registryService.requireTenantIntegration(tenantId, integrationId);
  }

  async getShoutoutSlackStatus(tenantId: string) {
    return this.registryService.getShoutoutSlackStatus(tenantId);
  }

  async isShoutoutSlackConfigured(tenantId: string): Promise<boolean> {
    return this.registryService.isShoutoutSlackConfigured(tenantId);
  }

  async syncUsers(integrationId: string, channelId?: string) {
    const integration = await this.registryService.requireTenantIntegration('', integrationId);
    const client = this.createClient(integration);
    let users: import('../integration.types').PlatformUserData[] = [];
    if (channelId) {
      users = await client.getChannelMembers(channelId);
    } else {
      users = (await client.listUsers()) as import('../integration.types').PlatformUserData[];
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
        const channels = await this.registryService.getActiveChannelsForIntegration(integration.id);
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

  private async upsertPlatformUser(
    integrationId: string,
    platformUserData: import('../integration.types').PlatformUserData,
  ) {
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
    const platformUserDataToSave: import('../integration.types').PlatformUserSaveData = {
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
    return this.registryService.disconnectIntegration(tenantId, integrationId, memberId);
  }

  async reconnectIntegration(tenantId: string, integrationId: string, memberId: string) {
    const result = await this.registryService.reconnectIntegration(
      tenantId,
      integrationId,
      memberId,
    );
    if (result.success) {
      await this.syncUsers(integrationId);
    }
    return result;
  }

  async getIntegrationStatus(integrationId: string) {
    return this.registryService.getIntegrationStatus(integrationId);
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
          const invitation = await this.invitationsService.inviteMember(
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
