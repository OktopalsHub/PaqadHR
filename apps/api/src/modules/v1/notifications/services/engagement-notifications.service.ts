import { Injectable } from '@nestjs/common';
import { NotificationChannel } from '../../../../common/enums/notification-channel.enum';
import type { NotificationPreferenceType } from '../../../../common/enums/notification-preference-type.enum';
import { NotificationPriority } from '../../../../common/enums/notification-priority.enum';
import { NotificationType } from '../../../../common/enums/notification-type.enum';
import { NotificationService } from './notification.service';
import { NotificationPreferenceService } from './notification-preference.service';

@Injectable()
export class EngagementNotificationsService {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly preferenceService: NotificationPreferenceService,
  ) {}

  private async shouldSend(
    recipientId: string,
    notificationType: NotificationPreferenceType,
    channel: NotificationChannel,
  ): Promise<boolean> {
    try {
      return await this.preferenceService.shouldSendNotification(
        recipientId,
        notificationType,
        channel,
      );
    } catch {
      return true;
    }
  }

  async sendShoutoutNotification(
    recipientId: string,
    tenantId: string,
    variables: {
      senderName: string;
      message: string;
      points?: number;
    },
  ): Promise<void> {
    const pointsText = variables.points ? ` (+${variables.points} Paq points)` : '';
    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel: NotificationChannel.BOTH,
      priority: NotificationPriority.MEDIUM,
      title: 'You received a shoutout!',
      message: `${variables.senderName} gave you a shoutout: "${variables.message}"${pointsText}`,
      recipientId,
      tenantId,
    });
  }

  async sendTaskAssignmentNotification(
    recipientId: string,
    tenantId: string,
    variables: {
      taskTitle: string;
      assignerName: string;
      dueDate?: string;
      taskUrl?: string;
    },
  ): Promise<void> {
    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel: NotificationChannel.IN_APP,
      priority: NotificationPriority.MEDIUM,
      title: 'New task assigned',
      message: `${variables.assignerName} assigned you a task: "${variables.taskTitle}"${variables.dueDate ? ` (Due: ${variables.dueDate})` : ''}`,
      recipientId,
      tenantId,
      actionData: variables.taskUrl
        ? { url: variables.taskUrl, buttonText: 'View Task', actionType: 'navigate' }
        : undefined,
      metadata: {
        type: 'task_assignment',
        taskTitle: variables.taskTitle,
        assignerName: variables.assignerName,
      },
    });
  }

  async sendMeetingReminderNotification(
    recipientIds: string[],
    tenantId: string,
    variables: {
      meetingTitle: string;
      startTime: string;
      meetingUrl?: string;
      organizerName: string;
    },
  ): Promise<void> {
    await this.notificationService.createBulkNotifications({
      recipientIds,
      channel: NotificationChannel.BOTH,
      priority: NotificationPriority.HIGH,
      title: 'Meeting reminder',
      message: `Reminder: "${variables.meetingTitle}" starts at ${variables.startTime}`,
      tenantId,
      actionData: variables.meetingUrl
        ? { url: variables.meetingUrl, buttonText: 'Join Meeting', actionType: 'external_link' }
        : undefined,
      metadata: {
        type: 'meeting_reminder',
        meetingTitle: variables.meetingTitle,
        organizerName: variables.organizerName,
      },
    });
  }

  async sendRewardRedemptionNotification(
    recipientId: string,
    tenantId: string,
    variables: {
      rewardName: string;
      status: 'processing' | 'fulfilled' | 'failed';
      points?: number;
      failureReason?: string;
    },
  ): Promise<void> {
    const statusMessages = {
      processing: 'is being processed',
      fulfilled: 'has been fulfilled',
      failed: 'could not be completed',
    };

    const pointsText = variables.points ? ` (${variables.points} Paq points)` : '';
    const failureText = variables.failureReason ? ` Reason: ${variables.failureReason}` : '';

    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel:
        variables.status === 'processing' ? NotificationChannel.IN_APP : NotificationChannel.BOTH,
      priority:
        variables.status === 'failed' ? NotificationPriority.HIGH : NotificationPriority.MEDIUM,
      title: `Reward ${variables.status}`,
      message: `Your reward "${variables.rewardName}" ${statusMessages[variables.status]}${pointsText}.${variables.status === 'failed' ? failureText : ''}`,
      recipientId,
      tenantId,
      metadata: {
        type: 'reward_redemption',
        rewardName: variables.rewardName,
        status: variables.status,
      },
    });
  }

  async sendPointsAwardedNotification(
    recipientId: string,
    tenantId: string,
    variables: {
      points: number;
      awardedBy: string;
      reason?: string;
    },
  ): Promise<void> {
    const channel = NotificationChannel.IN_APP;
    if (!(await this.shouldSend(recipientId, 'shoutout' as NotificationPreferenceType, channel))) {
      return;
    }
    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel,
      priority: NotificationPriority.LOW,
      title: 'Paq points awarded',
      message: `${variables.awardedBy} awarded you ${variables.points} Paq points${variables.reason ? `: ${variables.reason}` : ''}`,
      recipientId,
      tenantId,
      metadata: {
        type: 'points_awarded',
        points: variables.points,
        awardedBy: variables.awardedBy,
        reason: variables.reason ?? null,
      },
    });
  }

  async sendTaskCompletionPointsNotification(
    recipientId: string,
    tenantId: string,
    variables: {
      points: number;
      taskTitle: string;
    },
  ): Promise<void> {
    const channel = NotificationChannel.IN_APP;
    if (
      !(await this.shouldSend(
        recipientId,
        'task_assignment' as NotificationPreferenceType,
        channel,
      ))
    ) {
      return;
    }
    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel,
      priority: NotificationPriority.LOW,
      title: 'Task completed',
      message: `You earned ${variables.points} Paq points for completing "${variables.taskTitle}"`,
      recipientId,
      tenantId,
      metadata: {
        type: 'task_completion_points',
        points: variables.points,
        taskTitle: variables.taskTitle,
      },
    });
  }
}
