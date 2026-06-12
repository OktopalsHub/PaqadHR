import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { ENVIRONMENT } from 'src/common/config/env.config';
import { IntegrationType } from 'src/common/enums';
import { IsNull, Not } from 'typeorm';
import { TenantMembersService } from '../../../modules/v1/tenant-members/tenant-members.service';
import { UserSyncService } from './user-sync.service';
import { PlatformUserRepository } from "../repositories/platform-user.repository";
import { PlatformIntegrationRepository } from "../repositories/platform-integration.repository";
import { ShoutoutsService } from '../../../modules/v1/shoutouts/services/shoutouts.service';
import { PlatformIntegration } from '../entities/platform-integration.entity';
import {
  SlackEvent,
  SlackEventPayload,
  SlackInteractivePayload,
  SlackSlashCommandPayload,
} from '../integration.types';
import { TenantMember } from '../../../modules/v1/tenant-members/entities/tenant-member.entity';

@Injectable()
export class SlackWebhookService {
  private readonly logger = new Logger(SlackWebhookService.name);
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly userSyncService: UserSyncService,
    private readonly platformUserRepo: PlatformUserRepository,
    private readonly integrationRepo: PlatformIntegrationRepository,
    private readonly tenantMembersService: TenantMembersService,
    private readonly shoutoutsService: ShoutoutsService,
  ) {}
  async verifySlackSignature(
    rawBody: Buffer,
    signature: string,
    timestamp: string,
  ): Promise<boolean> {
    try {
      const slackSigningSecret = ENVIRONMENT.SLACK.SIGNING_SECRET;
      if (!slackSigningSecret) {
        this.logger.warn('SLACK_SIGNING_SECRET not configured');
        return false;
      }
      const currentTime = Math.floor(Date.now() / 1000);
      const requestTime = parseInt(timestamp, 10);
      if (Math.abs(currentTime - requestTime) > 300) {
        this.logger.warn('Slack webhook timestamp too old');
        return false;
      }
      const sigBasestring = `v0:${timestamp}:${rawBody}`;
      const expectedSignature = `v0=${crypto
        .createHmac('sha256', slackSigningSecret)
        .update(sigBasestring, 'utf8')
        .digest('hex')}`;
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature),
      );
    } catch (error) {
      this.logger.error('Error verifying Slack signature:', error);
      return false;
    }
  }
  async handleSlackEvent(eventPayload: SlackEventPayload): Promise<void> {
    try {
      const { event, team_id } = eventPayload;
      if (!event) return;
      this.logger.log(
        `Handling Slack event: ${event.type} for team: ${team_id}`,
      );
      switch (event.type) {
        case 'user_change':
          await this.handleUserChange(event, team_id ?? '');
          break;
        case 'team_join':
          await this.handleTeamJoin(event, team_id ?? '');
          break;
        case 'user_profile_changed':
          await this.handleUserProfileChanged(event, team_id ?? '');
          break;
        case 'app_home_opened':
          await this.handleAppHomeOpened(event, team_id ?? '');
          break;
        default:
          this.logger.log(`Unhandled Slack event type: ${event.type}`);
      }
    } catch (error) {
      this.logger.error('Error handling Slack event:', error);
    }
  }
  async handleInteractiveComponent(payload: SlackInteractivePayload): Promise<void> {
    try {
      const { type, user, team, actions } = payload;
      this.logger.log(
        `Handling interactive component: ${type} from user: ${user.id}`,
      );
      switch (type) {
        case 'block_actions':
          await this.handleBlockActions(payload);
          break;
        case 'view_submission':
          await this.handleViewSubmission(payload);
          break;
        case 'shortcut':
          await this.handleShortcut(payload);
          break;
        default:
          this.logger.log(`Unhandled interactive component type: ${type}`);
      }
    } catch (error) {
      this.logger.error('Error handling interactive component:', error);
    }
  }
  async handleSlashCommand(commandPayload: SlackSlashCommandPayload): Promise<unknown> {
    try {
      const { command, text, user_id, team_id, channel_id } = commandPayload;
      this.logger.log(
        `Handling slash command: ${command} from user: ${user_id}`,
      );
      switch (command) {
        case '/shoutout':
          return await this.handleShoutoutCommand(
            text,
            user_id,
            team_id,
            channel_id,
          );
        case '/kudos':
          return await this.handleShoutoutCommand(
            text,
            user_id,
            team_id,
            channel_id,
          );
        default:
          return {
            response_type: 'ephemeral',
            text: `Unknown command: ${command}`,
          };
      }
    } catch (error) {
      this.logger.error('Error handling slash command:', error);
      return {
        response_type: 'ephemeral',
        text: 'Sorry, there was an error processing your command.',
      };
    }
  }
  private async handleUserChange(event: SlackEvent, teamId: string): Promise<void> {
    const integration = await this.findIntegrationByTeamId(teamId);
    if (!integration || !event.user) return;
    const platformUser = await this.platformUserRepo.findOne({
      where: {
        integrationId: integration.id,
        platformUserId: event.user.id,
      },
    });
    if (platformUser) {
      await this.platformUserRepo.update(platformUser.id, {
        platformUsername: event.user.name,
        platformDisplayName: event.user.real_name,
        platformEmail: event.user.profile?.email,
        platformAvatarUrl: event.user.profile?.image_192,
      });
      this.logger.log(`Updated platform user: ${event.user.id}`);
    }
  }
  private async handleTeamJoin(event: SlackEvent, teamId: string): Promise<void> {
    const integration = await this.findIntegrationByTeamId(teamId);
    if (!integration) return;
    await this.userSyncService.syncAllUsers(
      integration.id,
      integration.tenantId,
    );
    this.logger.log(`Auto-synced new team member: ${event.user?.id}`);
  }
  private async handleUserProfileChanged(
    event: SlackEvent,
    teamId: string,
  ): Promise<void> {
    await this.handleUserChange(event, teamId);
  }
  private async handleAppHomeOpened(event: SlackEvent, teamId: string): Promise<void> {
    this.logger.log(`App home opened by user: ${event.user?.id}`);
  }
  private async handleBlockActions(payload: SlackInteractivePayload): Promise<void> {
    const action = payload.actions[0];
    switch (action.action_id) {
      case 'sync_users':
        await this.handleSyncUsersAction(payload);
        break;
      case 'match_user':
        await this.handleMatchUserAction(payload);
        break;
      default:
        this.logger.log(`Unhandled block action: ${action.action_id}`);
    }
  }
  private async handleViewSubmission(payload: SlackInteractivePayload): Promise<void> {
    const callbackId = payload.view?.callback_id;
    switch (callbackId) {
      case 'shoutout_modal':
        await this.handleShoutoutModalSubmission(payload);
        break;
      default:
        this.logger.log(`Unhandled view submission: ${callbackId}`);
    }
  }
  private async handleShortcut(payload: SlackInteractivePayload): Promise<void> {
    const callbackId = payload.callback_id;
    switch (callbackId) {
      case 'create_shoutout':
        await this.handleCreateShoutoutShortcut(payload);
        break;
      default:
        this.logger.log(`Unhandled shortcut: ${callbackId}`);
    }
  }
  private async handleShoutoutCommand(
    text: string,
    userId: string,
    teamId: string,
    channelId: string,
  ): Promise<unknown> {
    const integration = await this.findIntegrationByTeamId(teamId);
    if (!integration) {
      return {
        response_type: 'ephemeral',
        text: 'Shoutout integration not found for this workspace.',
      };
    }
    const mentionRegex = /<@([A-Z0-9]+)>/g;
    const mentions = [...text.matchAll(mentionRegex)];
    if (mentions.length === 0) {
      return {
        response_type: 'ephemeral',
        text: 'Please mention at least one user: `/shoutout @user Great work!`',
      };
    }
    let message = text.replace(mentionRegex, '').trim();
    let points = 10; 
    const pointsMatch = message.match(/\((\d+)\s*points?\)/i);
    if (pointsMatch) {
      points = parseInt(pointsMatch[1], 10);
      message = message.replace(pointsMatch[0], '').trim();
    }
    if (!message) {
      return {
        response_type: 'ephemeral',
        text: 'Please include a message: `/shoutout @user Great work!`',
      };
    }
    try {
      const sender = await this.findTenantMemberBySlackUser(
        userId,
        integration.id,
      );
      if (!sender) {
        return {
          response_type: 'ephemeral',
          text: 'Your Slack account is not linked to PaqadHR. Please contact your admin.',
        };
      }
      const recipientIds: string[] = [];
      for (const mention of mentions) {
        const slackUserId = mention[1];
        const recipient = await this.findTenantMemberBySlackUser(
          slackUserId,
          integration.id,
        );
        if (recipient && recipient.id !== sender.id) {
          recipientIds.push(recipient.id);
        }
      }
      const uniqueRecipientIds = [...new Set(recipientIds)];
      if (uniqueRecipientIds.length === 0) {
        return {
          response_type: 'ephemeral',
          text: 'None of the mentioned users are linked to PaqadHR accounts.',
        };
      }
      const shoutout = await this.shoutoutsService.createShoutout(
        integration.tenantId,
        sender.id,
        {
          recipientIds: uniqueRecipientIds,
          pointsPerRecipient: points,
          message,
          categoryIds: [],
          source: 'slack',
        },
      );
      const recipientNames = shoutout.recipients
        .map((r) => r.preferredName || [r.firstName, r.lastName].filter(Boolean).join(' ') || 'Someone')
        .join(', ');
      return {
        response_type: 'ephemeral',
        text: `Shoutout sent to ${recipientNames}! (${points} points each)`,
      };
    } catch (error) {
      this.logger.error('Error creating shoutout from slash command:', error);
      return {
        response_type: 'ephemeral',
        text: 'Sorry, there was an error creating the shoutout. Please try again.',
      };
    }
  }
  private async handleSyncUsersAction(payload: SlackInteractivePayload): Promise<void> {
    const teamId = payload.team.id;
    const integration = await this.findIntegrationByTeamId(teamId);
    if (integration) {
      await this.userSyncService.syncAllUsers(
        integration.id,
        integration.tenantId,
      );
    }
  }
  private async handleMatchUserAction(_payload: SlackInteractivePayload): Promise<void> {
    this.logger.log('Manual user matching requested');
  }
  private async handleShoutoutModalSubmission(_payload: SlackInteractivePayload): Promise<void> {
    this.logger.log('Shoutout modal submitted');
  }
  private async handleCreateShoutoutShortcut(_payload: SlackInteractivePayload): Promise<void> {
    this.logger.log('Create shoutout shortcut triggered');
  }
  private async findIntegrationByTeamId(
    teamId: string,
  ): Promise<PlatformIntegration | null> {
    return this.integrationRepo.findOne({
      where: {
        platformTeamId: teamId,
        type: IntegrationType.SLACK,
        isActive: true,
      },
    });
  }
  private async findTenantMemberBySlackUser(
    slackUserId: string,
    integrationId: string,
  ): Promise<TenantMember | null> {
    const platformUser = await this.platformUserRepo.findOne({
      where: {
        integrationId,
        platformUserId: slackUserId,
        tenantMemberId: Not(IsNull()),
      },
      relations: ['tenantMember'],
    });
    return platformUser?.tenantMember ?? null;
  }
}
