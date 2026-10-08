import * as crypto from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ENVIRONMENT } from 'src/common/config/env.config';
import { IntegrationType, LeaveStatus } from 'src/common/enums';
import type { PlatformIntegration } from 'src/common/integrations/entities/platform-integration.entity';
import type {
  SlackEvent,
  SlackEventPayload,
  SlackInteractivePayload,
  SlackSlashCommandPayload,
} from 'src/common/integrations/integration.types';
import { PlatformIntegrationRepository } from 'src/common/integrations/repositories/platform-integration.repository';
import { PlatformUserRepository } from 'src/common/integrations/repositories/platform-user.repository';
import { UserSyncService } from 'src/common/integrations/services/user-sync.service';
import { IsNull, Not } from 'typeorm';
import { LeaveService } from '../../leave/leave.service';
import {
  LeaveAuthorizationService,
  toMemberContext,
} from '../../leave/services/leave-authorization.service';
import { PayrollService } from '../../payroll/services/payroll.service';
import type { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { ShoutoutsService } from './shoutouts.service';

@Injectable()
export class SlackWebhookService {
  private readonly logger = new Logger(SlackWebhookService.name);
  constructor(
    private readonly userSyncService: UserSyncService,
    private readonly platformUserRepo: PlatformUserRepository,
    private readonly integrationRepo: PlatformIntegrationRepository,
    private readonly shoutoutsService: ShoutoutsService,
    private readonly leaveService: LeaveService,
    private readonly leaveAuthorizationService: LeaveAuthorizationService,
    private readonly payrollService: PayrollService,
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
      return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
    } catch (error) {
      this.logger.error('Error verifying Slack signature:', error);
      return false;
    }
  }
  async handleSlackEvent(eventPayload: SlackEventPayload): Promise<void> {
    try {
      const { event, team_id } = eventPayload;
      if (!event) return;
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
          break;
        default:
      }
    } catch (error) {
      this.logger.error('Error handling Slack event:', error);
    }
  }
  async handleInteractiveComponent(payload: SlackInteractivePayload): Promise<unknown> {
    try {
      const { type } = payload;
      switch (type) {
        case 'block_actions':
          return await this.handleBlockActions(payload);
        case 'view_submission':
          await this.handleViewSubmission(payload);
          return { ok: true };
        case 'shortcut':
          await this.handleShortcut(payload);
          return { ok: true };
        default:
          return { ok: true };
      }
    } catch (error) {
      this.logger.error('Error handling interactive component:', error);
      return {
        response_type: 'ephemeral',
        text: 'Sorry, there was an error processing your action.',
      };
    }
  }
  async handleSlashCommand(commandPayload: SlackSlashCommandPayload): Promise<unknown> {
    try {
      const { command, text, user_id, team_id, channel_id } = commandPayload;
      switch (command) {
        case '/shoutout':
          return await this.handleShoutoutCommand(text, user_id, team_id, channel_id);
        case '/kudos':
          return await this.handleShoutoutCommand(text, user_id, team_id, channel_id);
        case '/leaves':
        case '/leave':
          return await this.handleLeaveCommand(text, user_id, team_id);
        case '/approvals':
          return await this.handleApprovalsCommand(user_id, team_id);
        case '/paqadhr':
          return this.handlePaqadhrHelpCommand();
        case '/payroll':
          return await this.handlePayrollCommand(text, user_id, team_id);
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
    }
  }
  private async handleTeamJoin(event: SlackEvent, teamId: string): Promise<void> {
    const integration = await this.findIntegrationByTeamId(teamId);
    if (!integration) return;
    await this.userSyncService.syncAllUsers(integration.id, integration.tenantId);
  }
  private async handleUserProfileChanged(event: SlackEvent, teamId: string): Promise<void> {
    await this.handleUserChange(event, teamId);
  }
  private async handleBlockActions(payload: SlackInteractivePayload): Promise<unknown> {
    const action = payload.actions[0];
    switch (action.action_id) {
      case 'sync_users':
        await this.handleSyncUsersAction(payload);
        return { ok: true };
      case 'approve_leave':
        return this.handleLeaveDecisionAction(payload, true);
      case 'reject_leave':
        return this.handleLeaveDecisionAction(payload, false);
      default:
        return { ok: true };
    }
  }
  private async handleViewSubmission(_payload: SlackInteractivePayload): Promise<void> {}
  private async handleShortcut(_payload: SlackInteractivePayload): Promise<void> {}
  private async handleLeaveCommand(text: string, userId: string, teamId: string): Promise<unknown> {
    const context = await this.resolveSlackMemberContext(userId, teamId);
    if ('error' in context) {
      return { response_type: 'ephemeral', text: context.error };
    }

    const trimmed = text.trim();
    if (!trimmed || trimmed === 'balance') {
      const balances = await this.leaveService.getLeaveBalanceForMember(
        context.tenantId,
        context.member.id,
      );
      const lines = (balances ?? []).map(
        (balance) =>
          `• ${balance.leaveType?.name ?? 'Leave'}: ${balance.remainingDays} days remaining`,
      );
      return {
        response_type: 'ephemeral',
        text: lines.length
          ? `Your leave balances:\n${lines.join('\n')}`
          : 'No leave balances found.',
      };
    }

    const requestMatch = trimmed.match(/^request\s+(\S+)\s+(\S+)(?:\s+(.+))?$/i);
    if (!requestMatch) {
      return {
        response_type: 'ephemeral',
        text: 'Usage: `/leaves balance` or `/leaves request YYYY-MM-DD YYYY-MM-DD [reason]`',
      };
    }

    const [, startDate, endDate, reason] = requestMatch;
    const balances = await this.leaveService.getLeaveBalanceForMember(
      context.tenantId,
      context.member.id,
    );
    const firstBalance = balances?.[0];
    if (!firstBalance?.leaveTypeId) {
      return {
        response_type: 'ephemeral',
        text: 'No leave type configured for your account. Contact HR.',
      };
    }

    const leave = await this.leaveService.createLeave(context.tenantId, context.member.id, {
      leaveTypeId: firstBalance.leaveTypeId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason: reason?.trim(),
    });

    return {
      response_type: 'ephemeral',
      text: `Leave request submitted (${leave.duration} days). Status: ${leave.status}`,
    };
  }

  private async handleApprovalsCommand(userId: string, teamId: string): Promise<unknown> {
    const context = await this.resolveSlackMemberContext(userId, teamId);
    if ('error' in context) {
      return { response_type: 'ephemeral', text: context.error };
    }

    const pending = await this.leaveAuthorizationService.listPendingLeavesForApprover(
      context.tenantId,
      toMemberContext(context.member),
      { page: 1, limit: 10 },
      { status: LeaveStatus.PENDING },
    );

    if (!pending.records?.length) {
      return { response_type: 'ephemeral', text: 'No pending leave approvals.' };
    }

    const blocks: Record<string, unknown>[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Pending leave approvals* — approve or reject below:',
        },
      },
    ];

    for (const leave of pending.records.slice(0, 5)) {
      const requester =
        leave.requester?.preferredName ||
        [leave.requester?.firstName, leave.requester?.lastName].filter(Boolean).join(' ') ||
        'Someone';
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${requester}*\n${String(leave.startDate).slice(0, 10)} → ${String(leave.endDate).slice(0, 10)} (${leave.duration}d)`,
        },
      });
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Approve' },
            style: 'primary',
            action_id: 'approve_leave',
            value: leave.id,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Reject' },
            style: 'danger',
            action_id: 'reject_leave',
            value: leave.id,
          },
        ],
      });
    }

    return {
      response_type: 'ephemeral',
      blocks,
    };
  }

  private handlePaqadhrHelpCommand(): unknown {
    return {
      response_type: 'ephemeral',
      text: [
        '*PaqadHR Slack commands*',
        '• `/shoutout @user message` — send recognition',
        '• `/leaves balance` — your leave balances',
        '• `/leaves request YYYY-MM-DD YYYY-MM-DD [reason]` — request time off',
        '• `/approvals` — pending leave requests (with approve/reject buttons)',
        '• `/payroll` — list recent payroll runs',
        '• `/payroll status <run-id>` — payroll run status',
      ].join('\n'),
    };
  }

  private async handlePayrollCommand(
    text: string,
    userId: string,
    teamId: string,
  ): Promise<unknown> {
    const context = await this.resolveSlackMemberContext(userId, teamId);
    if ('error' in context) {
      return { response_type: 'ephemeral', text: context.error };
    }

    const trimmed = text.trim();
    const statusMatch = trimmed.match(/^status\s+(\S+)$/i);
    if (statusMatch) {
      const run = await this.payrollService.getPayrollRunForRequester(
        statusMatch[1],
        context.tenantId,
        context.member.id,
        context.member.role,
      );
      if (!run) {
        return { response_type: 'ephemeral', text: 'Payroll run not found.' };
      }
      return {
        response_type: 'ephemeral',
        text: `*${run.title}*\nStatus: ${run.status}\nPeriod: ${String(run.periodStart).slice(0, 10)} → ${String(run.periodEnd).slice(0, 10)}\nEmployees: ${run.employeeCount}`,
      };
    }

    const { runs } = await this.payrollService.getPayrollRunsForRequester(
      context.tenantId,
      5,
      0,
      context.member.id,
      context.member.role,
    );
    if (!runs.length) {
      return { response_type: 'ephemeral', text: 'No payroll runs found.' };
    }

    const lines = runs.map(
      (run) =>
        `• *${run.title}* — ${run.status} (${String(run.periodStart).slice(0, 10)} → ${String(run.periodEnd).slice(0, 10)}) [id: ${run.id}]`,
    );
    return {
      response_type: 'ephemeral',
      text: `Recent payroll runs:\n${lines.join('\n')}\n\nUse \`/payroll status <run-id>\` for details.`,
    };
  }

  private async handleLeaveDecisionAction(
    payload: SlackInteractivePayload,
    approve: boolean,
  ): Promise<unknown> {
    const leaveId = payload.actions[0]?.value;
    if (!leaveId) {
      return { response_type: 'ephemeral', text: 'Missing leave request id.' };
    }

    const context = await this.resolveSlackMemberContext(payload.user.id, payload.team.id);
    if ('error' in context) {
      return { response_type: 'ephemeral', text: context.error };
    }

    try {
      const member = toMemberContext(context.member);
      if (approve) {
        await this.leaveAuthorizationService.assertCanApproveOrReject(
          context.tenantId,
          member,
          leaveId,
        );
        await this.leaveService.approveLeave(
          context.tenantId,
          leaveId,
          context.member.id,
          'Approved via Slack',
        );
        return {
          response_type: 'ephemeral',
          replace_original: true,
          text: 'Leave request approved.',
        };
      }

      await this.leaveAuthorizationService.assertCanApproveOrReject(
        context.tenantId,
        member,
        leaveId,
      );
      await this.leaveService.rejectLeave(
        context.tenantId,
        leaveId,
        context.member.id,
        'Rejected via Slack',
      );
      return {
        response_type: 'ephemeral',
        replace_original: true,
        text: 'Leave request rejected.',
      };
    } catch (error) {
      this.logger.error('Error processing leave decision from Slack:', error);
      return {
        response_type: 'ephemeral',
        text: 'Could not update leave request. You may lack permission or the request is no longer pending.',
      };
    }
  }

  private async resolveSlackMemberContext(
    slackUserId: string,
    teamId: string,
  ): Promise<
    { tenantId: string; member: TenantMember; integrationId: string } | { error: string }
  > {
    const integration = await this.findIntegrationByTeamId(teamId);
    if (!integration) {
      return { error: 'PaqadHR integration not found for this workspace.' };
    }

    const member = await this.findTenantMemberBySlackUser(slackUserId, integration.id);
    if (!member) {
      return {
        error: 'Your Slack account is not linked to PaqadHR. Please contact your admin.',
      };
    }

    return { tenantId: integration.tenantId, member, integrationId: integration.id };
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
      const sender = await this.findTenantMemberBySlackUser(userId, integration.id);
      if (!sender) {
        return {
          response_type: 'ephemeral',
          text: 'Your Slack account is not linked to PaqadHR. Please contact your admin.',
        };
      }
      const recipientIds: string[] = [];
      for (const mention of mentions) {
        const slackUserId = mention[1];
        const recipient = await this.findTenantMemberBySlackUser(slackUserId, integration.id);
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
      const shoutout = await this.shoutoutsService.createShoutout(integration.tenantId, sender.id, {
        recipients: uniqueRecipientIds.map((recipientId) => ({ recipientId, points })),
        message,
        categoryIds: [],
        source: 'slack',
      });
      const recipientNames = shoutout.recipients
        .map(
          (r) =>
            r.preferredName || [r.firstName, r.lastName].filter(Boolean).join(' ') || 'Someone',
        )
        .join(', ');
      return {
        response_type: 'ephemeral',
        text: `Shoutout sent to ${recipientNames}! (${points} Paq points each)`,
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
      await this.userSyncService.syncAllUsers(integration.id, integration.tenantId);
    }
  }
  private async findIntegrationByTeamId(teamId: string): Promise<PlatformIntegration | null> {
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
