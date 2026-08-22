import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type FindOptionsWhere, In, IsNull, type Repository } from 'typeorm';

import { NotificationChannel } from '../../../../common/enums/notification-channel.enum';
import { NotificationPriority } from '../../../../common/enums/notification-priority.enum';
import { NotificationStatus } from '../../../../common/enums/notification-status.enum';
import { NotificationType } from '../../../../common/enums/notification-type.enum';
import { ActivitiesService } from '../../activities/services/activities.service';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import type {
  CreateBulkNotificationDto,
  CreateNotificationDto,
} from '../dto/create-notification.dto';
import { Notification } from '../entities/notification.entity';
import { NotificationPreference } from '../entities/notification-preference.entity';
import { SSENotificationService } from './sse-notification.service';
import { ZeptomailEmailService } from './zeptomail-email.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationPreference)
    _preferenceRepository: Repository<NotificationPreference>,
    private emailService: ZeptomailEmailService,
    private sseNotificationService: SSENotificationService,
    private tenantMembersService: TenantMembersService,
    private readonly activitiesService: ActivitiesService,
  ) {}

  async createNotification(dto: CreateNotificationDto): Promise<Notification> {
    if (dto.recipientId && dto.tenantId) {
      await this.assertRecipientIsTenantMember(dto.recipientId, dto.tenantId);
    }

    const notification = this.notificationRepository.create(dto);
    const saved = await this.notificationRepository.save(notification);
    await this.deliver(saved);
    return saved;
  }

  async createBulkNotifications(dto: CreateBulkNotificationDto): Promise<Notification[]> {
    if (dto.tenantId) {
      await this.assertRecipientsAreTenantMembers(dto.recipientIds, dto.tenantId);
    }

    const notifications = dto.recipientIds.map((recipientId) =>
      this.notificationRepository.create({
        ...dto,
        type: NotificationType.USER,
        recipientId,
      }),
    );

    const saved = await this.notificationRepository.save(notifications);
    await Promise.allSettled(saved.map((n) => this.deliver(n)));
    return saved;
  }

  async sendSystemNotification(
    title: string,
    message: string,
    channel: NotificationChannel = NotificationChannel.IN_APP,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.createNotification({
      type: NotificationType.SYSTEM,
      channel,
      title,
      message,
      metadata,
    });
  }

  async sendTenantNotification(
    tenantId: string,
    title: string,
    message: string,
    channel: NotificationChannel = NotificationChannel.IN_APP,
    metadata?: Record<string, unknown>,
    priority?: NotificationPriority,
  ): Promise<void> {
    await this.createNotification({
      type: NotificationType.TENANT,
      channel,
      title,
      message,
      tenantId,
      metadata,
      ...(priority ? { priority } : {}),
    });
  }

  async broadcastToTenant(
    tenantId: string,
    dto: {
      title: string;
      message: string;
      channel: NotificationChannel;
      priority?: NotificationPriority;
      metadata?: Record<string, unknown>;
    },
  ): Promise<{ recipients: number }> {
    const members = await this.tenantMembersService.listActiveTenantMembers(tenantId);
    if (members.length === 0) {
      return { recipients: 0 };
    }

    await this.createBulkNotifications({
      recipientIds: members.map((member) => member.id),
      channel: dto.channel,
      title: dto.title,
      message: dto.message,
      ...(dto.priority ? { priority: dto.priority } : {}),
      metadata: dto.metadata,
      tenantId,
    });
    return { recipients: members.length };
  }

  async getUserNotifications(
    memberId: string,
    tenantId?: string,
    options?: { limit?: number; offset?: number; unreadOnly?: boolean },
  ): Promise<{ notifications: Notification[]; total: number }> {
    const where: FindOptionsWhere<Notification>[] = [];

    if (tenantId) {
      where.push(
        { tenantId, recipientId: memberId },
        { tenantId, recipientId: IsNull() },
        { type: NotificationType.SYSTEM, tenantId: IsNull(), recipientId: IsNull() },
      );
    } else {
      where.push({ type: NotificationType.SYSTEM, tenantId: IsNull(), recipientId: IsNull() });
    }

    const qb = this.notificationRepository
      .createQueryBuilder('n')
      .where(where)
      .orderBy('n.createdAt', 'DESC');

    if (options?.unreadOnly) qb.andWhere('n.readAt IS NULL');
    if (options?.limit) qb.limit(options.limit);
    if (options?.offset) qb.offset(options.offset);

    const [notifications, total] = await qb.getManyAndCount();
    return { notifications, total };
  }

  async markAsRead(notificationId: string, memberId: string, tenantId?: string): Promise<void> {
    const where: FindOptionsWhere<Notification> = {
      id: notificationId,
      recipientId: memberId,
    };
    if (tenantId) where.tenantId = tenantId;

    await this.notificationRepository.update(where, {
      readAt: new Date(),
      status: NotificationStatus.READ,
    });

    if (tenantId) {
      this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId: memberId,
          action: 'notification.marked_read',
          description: 'Notification marked as read',
          metadata: { notificationId },
        })
        .catch(() => {});
    }
  }

  async markMultipleAsRead(
    notificationIds: string[],
    memberId: string,
    tenantId?: string,
  ): Promise<void> {
    const where: FindOptionsWhere<Notification> = {
      id: In(notificationIds),
      recipientId: memberId,
    };
    if (tenantId) where.tenantId = tenantId;

    await this.notificationRepository.update(where, {
      readAt: new Date(),
      status: NotificationStatus.READ,
    });
  }

  async markAllAsRead(memberId: string, tenantId?: string): Promise<void> {
    const where: FindOptionsWhere<Notification> = { recipientId: memberId };
    if (tenantId) where.tenantId = tenantId;

    await this.notificationRepository.update(where, {
      readAt: new Date(),
      status: NotificationStatus.READ,
    });

    if (tenantId) {
      this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId: memberId,
          action: 'notification.mark_all_read',
          description: 'All notifications marked as read',
          metadata: {},
        })
        .catch(() => {});
    }
  }

  async getUnreadCount(memberId: string, tenantId?: string): Promise<number> {
    const where: FindOptionsWhere<Notification>[] = [];

    if (tenantId) {
      where.push(
        { tenantId, recipientId: memberId, readAt: IsNull() },
        { tenantId, recipientId: IsNull(), readAt: IsNull() },
        {
          type: NotificationType.SYSTEM,
          tenantId: IsNull(),
          recipientId: IsNull(),
          readAt: IsNull(),
        },
      );
    } else {
      where.push({
        type: NotificationType.SYSTEM,
        tenantId: IsNull(),
        recipientId: IsNull(),
        readAt: IsNull(),
      });
    }

    return this.notificationRepository.count({ where });
  }

  async deleteNotification(
    notificationId: string,
    memberId: string,
    tenantId?: string,
  ): Promise<void> {
    const result = await this.notificationRepository.delete({
      id: notificationId,
      recipientId: memberId,
    });

    if (result.affected === 0) {
      throw new NotFoundException('Notification not found');
    }

    if (tenantId) {
      this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId: memberId,
          action: 'notification.deleted',
          description: 'Notification deleted',
          metadata: { notificationId },
        })
        .catch(() => {});
    }
  }

  // --- private helpers ---

  private async deliver(notification: Notification): Promise<void> {
    try {
      const shouldSendEmail =
        notification.channel === NotificationChannel.EMAIL ||
        notification.channel === NotificationChannel.BOTH;

      const shouldSendInApp =
        notification.channel === NotificationChannel.IN_APP ||
        notification.channel === NotificationChannel.BOTH;

      if (shouldSendEmail) await this.sendEmail(notification);
      if (shouldSendInApp) this.sendInApp(notification);

      await this.notificationRepository.update(notification.id, {
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      });
    } catch (error) {
      this.logger.error(`Failed to deliver notification ${notification.id}:`, error);
      await this.notificationRepository.update(notification.id, {
        status: NotificationStatus.FAILED,
      });
    }
  }

  private async sendEmail(notification: Notification): Promise<void> {
    if (!notification.recipientId || !notification.tenantId) {
      this.logger.warn('Cannot send email without recipient and tenant');
      return;
    }

    const email = await this.getRecipientEmail(notification.recipientId, notification.tenantId);
    if (!email) {
      this.logger.warn(`No email found for recipient ${notification.recipientId}`);
      return;
    }

    await this.emailService.sendTemplateEmail(email, 'notification', {
      title: notification.title,
      message: notification.message,
      actionUrl: notification.actionData?.url,
      actionLabel: notification.actionData?.buttonText,
    });
  }

  private sendInApp(notification: Notification): void {
    const payload = {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      metadata: notification.metadata,
      actionData: notification.actionData,
    };

    if (notification.type === NotificationType.SYSTEM) {
      this.sseNotificationService.sendSystemNotification(payload);
    } else if (notification.type === NotificationType.TENANT && notification.tenantId) {
      this.sseNotificationService.sendToTenant(notification.tenantId, payload);
    } else if (notification.recipientId) {
      this.sseNotificationService.sendToUser(notification.recipientId, payload);
    }
  }

  private async getRecipientEmail(recipientId: string, tenantId: string): Promise<string | null> {
    try {
      const member = await this.tenantMembersService.getTenantMember(recipientId, tenantId);
      return member.user?.email ?? null;
    } catch (error) {
      this.logger.error(`Failed to get recipient email for ${recipientId}:`, error);
      return null;
    }
  }

  private async assertRecipientIsTenantMember(
    recipientId: string,
    tenantId: string,
  ): Promise<void> {
    const exists = await this.tenantMembersService.memberExistsInTenant(tenantId, recipientId);
    if (!exists) {
      throw new BadRequestException('Recipient is not a member of this tenant');
    }
  }

  private async assertRecipientsAreTenantMembers(
    recipientIds: string[],
    tenantId: string,
  ): Promise<void> {
    const memberIds = await this.tenantMembersService.filterTenantMemberIds(tenantId, recipientIds);
    const invalid = recipientIds.find((id) => !memberIds.has(id));
    if (invalid) {
      throw new BadRequestException('Recipient is not a member of this tenant');
    }
  }
}
