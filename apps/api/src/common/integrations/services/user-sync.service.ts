import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IntegrationType } from 'src/common/enums';
import type { IPlatformUser } from 'src/common/interfaces';
import { IsNull } from 'typeorm';
import { InvitationsService } from '../../../modules/v1/invitations/invitations.service';
import { TenantMembersService } from '../../../modules/v1/tenant-members/tenant-members.service';
import { SlackClient } from '../clients/slack.client';
import type { PlatformIntegration } from '../entities/platform-integration.entity';
import type { PlatformUserData, PlatformUserSaveData } from '../integration.types';
import { PlatformIntegrationRepository } from '../repositories/platform-integration.repository';
import { PlatformUserRepository } from '../repositories/platform-user.repository';

@Injectable()
export class UserSyncService {
  private readonly logger = new Logger(UserSyncService.name);
  constructor(
    private readonly tenantMembersService: TenantMembersService,
    private readonly invitationsService: InvitationsService,
    private readonly platformUserRepo: PlatformUserRepository,
    private readonly integrationRepo: PlatformIntegrationRepository,
  ) {}
  @OnEvent('integration.connected')
  async handleIntegrationConnected(payload: {
    integrationId: string;
    tenantId: string;
    platform: IntegrationType;
  }) {
    try {
      await this.syncAllUsers(payload.integrationId, payload.tenantId);
    } catch (error) {
      this.logger.error(
        `Failed to auto-sync users: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
  async syncAllUsers(integrationId: string, tenantId: string) {
    const integration = await this.integrationRepo.findOne({
      where: { id: integrationId },
    });
    if (!integration) {
      throw new NotFoundException('Integration not found');
    }
    const platformUsers = await this.getPlatformUsers(integration);
    const tenantMembers = await this.tenantMembersService.getTenantMembers(tenantId);
    const syncResults = {
      matched: 0,
      unmatched: 0,
      created: 0,
      errors: 0,
    };
    for (const platformUser of platformUsers) {
      try {
        const matchedMember = tenantMembers.find(
          (member) => member.user?.email?.toLowerCase() === platformUser.email?.toLowerCase(),
        );
        if (matchedMember) {
          await this.upsertPlatformUser(integrationId, platformUser, matchedMember.id);
          syncResults.matched++;
        } else {
          await this.upsertPlatformUser(integrationId, platformUser, null);
          syncResults.unmatched++;
        }
      } catch (error) {
        this.logger.error(
          `Error syncing user ${platformUser.email}: ${error instanceof Error ? error.message : String(error)}`,
        );
        syncResults.errors++;
      }
    }
    return syncResults;
  }
  async manualUserMatch(integrationId: string, platformUserId: string, tenantMemberId: string) {
    const platformUser = await this.platformUserRepo.findOne({
      where: { integrationId, platformUserId },
    });
    if (!platformUser) {
      throw new NotFoundException('Platform user not found');
    }
    await this.platformUserRepo.update(platformUser.id, {
      tenantMemberId,
    });
    return { success: true, message: 'User matched successfully' };
  }
  async getUnmatchedUsers(integrationId: string) {
    return this.platformUserRepo.find({
      where: {
        integrationId,
        tenantMemberId: IsNull(),
      },
    });
  }
  async getSyncStatus(integrationId: string) {
    const [total, matched, unmatched] = await Promise.all([
      this.platformUserRepo
        .createQueryBuilder('pu')
        .where('pu.integrationId = :integrationId', { integrationId })
        .getCount(),
      this.platformUserRepo
        .createQueryBuilder('pu')
        .where('pu.integrationId = :integrationId', { integrationId })
        .andWhere('pu.tenantMemberId IS NOT NULL')
        .getCount(),
      this.platformUserRepo
        .createQueryBuilder('pu')
        .where('pu.integrationId = :integrationId', { integrationId })
        .andWhere('pu.tenantMemberId IS NULL')
        .getCount(),
    ]);
    return {
      total,
      matched,
      unmatched,
      matchRate: total > 0 ? Math.round((matched / total) * 100) : 0,
    };
  }
  async bulkInviteUnmatchedUsers(integrationId: string, tenantId: string, invitedBy: string) {
    const unmatchedUsers = await this.getUnmatchedUsers(integrationId);
    const inviteResults = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };
    for (const platformUser of unmatchedUsers) {
      try {
        if (platformUser.platformEmail) {
          await this.invitationsService.inviteMember(
            tenantId,
            {
              email: platformUser.platformEmail,
              firstName: platformUser.platformDisplayName?.split(' ')[0] || 'User',
              lastName: platformUser.platformDisplayName?.split(' ').slice(1).join(' ') || '',
              sendWelcomeEmail: true,
            },
            invitedBy,
          );
          inviteResults.sent++;
        }
      } catch (error) {
        inviteResults.failed++;
        inviteResults.errors.push(
          `${platformUser.platformEmail}: ${error instanceof Error ? error.message : String(error)}`,
        );
        this.logger.error(`Failed to invite platform user ${platformUser.id}:`, error);
      }
    }
    return inviteResults;
  }
  private async getPlatformUsers(integration: PlatformIntegration): Promise<IPlatformUser[]> {
    const client = this.createClient(integration);
    return client.listUsers() as Promise<IPlatformUser[]>;
  }
  private createClient(integration: PlatformIntegration): SlackClient {
    switch (integration.type) {
      case IntegrationType.SLACK:
        return new SlackClient(integration.botToken);
      default:
        throw new BadRequestException(`Unsupported integration type: ${integration.type}`);
    }
  }
  private async upsertPlatformUser(
    integrationId: string,
    platformUserData: PlatformUserData,
    tenantMemberId: string | null,
  ) {
    const existingUser = await this.platformUserRepo.findOne({
      where: {
        integrationId,
        platformUserId: platformUserData.id,
      },
    });
    const userData: PlatformUserSaveData = {
      integrationId,
      platformUserId: platformUserData.id,
      platformUsername: platformUserData.username,
      platformDisplayName: platformUserData.displayName,
      platformEmail: platformUserData.email,
      platformAvatarUrl: platformUserData.avatarUrl,
    };
    if (tenantMemberId) {
      userData.tenantMemberId = tenantMemberId;
    }
    if (existingUser) {
      await this.platformUserRepo.update(existingUser.id, userData);
      return this.platformUserRepo.findOne({ where: { id: existingUser.id } });
    }
    return this.platformUserRepo.save(userData);
  }
}
