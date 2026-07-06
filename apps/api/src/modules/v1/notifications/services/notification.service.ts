import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type FindOptionsWhere, In, IsNull, type Repository } from 'typeorm';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import { NotificationChannel } from '../../../../common/enums/notification-channel.enum';
import { NotificationStatus } from '../../../../common/enums/notification-status.enum';
import { NotificationType } from '../../../../common/enums/notification-type.enum';
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
  ) {}

  private async assertRecipientIsTenantMember(
    recipientId: string,
    tenantId: string,
  ): Promise<void> {
    const membership = await this.tenantMembersService.findUserTenantMembership(
      recipientId,
      tenantId,
    );
    if (!membership) {
      throw new BadRequestException('Recipient is not a member of this tenant');
    }
  }

  private async assertRecipientsAreTenantMembers(
    recipientIds: string[],
    tenantId: string,
  ): Promise<void> {
    const memberIds = await this.tenantMembersService.findTenantMemberUserIds(
      tenantId,
      recipientIds,
    );
    const invalid = recipientIds.find((recipientId) => !memberIds.has(recipientId));
    if (invalid) {
      throw new BadRequestException('Recipient is not a member of this tenant');
    }
  }

  async createNotification(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    if (createNotificationDto.recipientId && createNotificationDto.tenantId) {
      await this.assertRecipientIsTenantMember(
        createNotificationDto.recipientId,
        createNotificationDto.tenantId,
      );
    }
    const notification = this.notificationRepository.create(createNotificationDto);
    const savedNotification = await this.notificationRepository.save(notification);
    await this.sendNotification(savedNotification);
    return savedNotification;
  }
  async createBulkNotifications(createBulkDto: CreateBulkNotificationDto): Promise<Notification[]> {
    if (createBulkDto.tenantId) {
      await this.assertRecipientsAreTenantMembers(
        createBulkDto.recipientIds,
        createBulkDto.tenantId,
      );
    }
    const notifications = createBulkDto.recipientIds.map((recipientId) =>
      this.notificationRepository.create({
        ...createBulkDto,
        type: NotificationType.USER,
        recipientId,
      }),
    );
    const savedNotifications = await this.notificationRepository.save(notifications);
    await Promise.allSettled(
      savedNotifications.map((notification) => this.sendNotification(notification)),
    );
    return savedNotifications;
  }
  async sendSystemNotification(
    title: string,
    message: string,
    channel: NotificationChannel = NotificationChannel.IN_APP,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const _notification = await this.createNotification({
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
  ): Promise<void> {
    const _notification = await this.createNotification({
      type: NotificationType.TENANT,
      channel,
      title,
      message,
      tenantId,
      metadata,
    });
  }
  async getUserNotifications(
    userId: string,
    tenantId?: string,
    options?: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
    },
  ): Promise<{ notifications: Notification[]; total: number }> {
    const where: FindOptionsWhere<Notification>[] = [{ recipientId: userId }];
    if (tenantId) {
      where.push(
        { tenantId, recipientId: IsNull() },
        {
          type: NotificationType.SYSTEM,
          tenantId: IsNull(),
          recipientId: IsNull(),
        },
      );
    } else {
      where.push({
        type: NotificationType.SYSTEM,
        tenantId: IsNull(),
        recipientId: IsNull(),
      });
    }
    const queryBuilder = this.notificationRepository
      .createQueryBuilder('notification')
      .where(where)
      .orderBy('notification.createdAt', 'DESC');
    if (options?.unreadOnly) {
      queryBuilder.andWhere('notification.readAt IS NULL');
    }
    if (options?.limit) {
      queryBuilder.limit(options.limit);
    }
    if (options?.offset) {
      queryBuilder.offset(options.offset);
    }
    const [notifications, total] = await queryBuilder.getManyAndCount();
    return { notifications, total };
  }
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.notificationRepository.update(
      {
        id: notificationId,
        recipientId: userId,
      },
      {
        readAt: new Date(),
        status: NotificationStatus.READ,
      },
    );
  }
  async markMultipleAsRead(notificationIds: string[], userId: string): Promise<void> {
    await this.notificationRepository.update(
      {
        id: In(notificationIds),
        recipientId: userId,
      },
      {
        readAt: new Date(),
        status: NotificationStatus.READ,
      },
    );
  }
  async markAllAsRead(userId: string, tenantId?: string): Promise<void> {
    const where: FindOptionsWhere<Notification> = { recipientId: userId };
    if (tenantId) {
      where.tenantId = tenantId;
    }
    await this.notificationRepository.update(where, {
      readAt: new Date(),
      status: NotificationStatus.READ,
    });
  }
  async getUnreadCount(userId: string, tenantId?: string): Promise<number> {
    const where: FindOptionsWhere<Notification>[] = [{ recipientId: userId, readAt: IsNull() }];
    if (tenantId) {
      where.push(
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
    return await this.notificationRepository.count({ where });
  }
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    const result = await this.notificationRepository.delete({
      id: notificationId,
      recipientId: userId,
    });
    if (result.affected === 0) {
      throw new NotFoundException('Notification not found');
    }
  }
  private async sendNotification(notification: Notification): Promise<void> {
    try {
      if (
        notification.channel === NotificationChannel.EMAIL ||
        notification.channel === NotificationChannel.BOTH
      ) {
        await this.sendEmailNotification(notification);
      }
      if (
        notification.channel === NotificationChannel.IN_APP ||
        notification.channel === NotificationChannel.BOTH
      ) {
        await this.sendInAppNotification(notification);
      }
      await this.notificationRepository.update(notification.id, {
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      });
    } catch (error) {
      this.logger.error(`Failed to send notification ${notification.id}:`, error);
      await this.notificationRepository.update(notification.id, {
        status: NotificationStatus.FAILED,
        errorMessage: error.message,
        retryCount: notification.retryCount + 1,
      });
    }
  }
  private async sendEmailNotification(notification: Notification): Promise<void> {
    if (!notification.recipientId) {
      this.logger.warn('Cannot send email notification without recipient');
      return;
    }
    const recipientEmail = await this.getRecipientEmail(notification.recipientId);
    if (!recipientEmail) {
      throw new NotFoundException('Recipient email not found');
    }
    if (notification.emailTemplate) {
      await this.emailService.sendTemplateEmail(
        recipientEmail,
        notification.emailTemplate,
        notification.emailContext || {},
        {
          subject: notification.emailSubject,
        },
      );
    } else {
      await this.emailService.sendEmail({
        to: recipientEmail,
        subject: notification.emailSubject || notification.title,
        html: `
          <h1>${notification.title}</h1>
          <p>${notification.message}</p>
          ${
            notification.actionData?.url
              ? `
            <p><a href="${notification.actionData.url}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              ${notification.actionData.buttonText || 'View'}
            </a></p>
          `
              : ''
          }
        `,
        text: `${notification.title}\n\n${notification.message}${notification.actionData?.url ? `\n\n${notification.actionData.buttonText || 'View'}: ${notification.actionData.url}` : ''}`,
      });
    }
  }
  private async sendInAppNotification(notification: Notification): Promise<void> {
    if (notification.type === NotificationType.SYSTEM) {
      this.sseNotificationService.sendSystemNotification({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        metadata: notification.metadata,
        actionData: notification.actionData,
      });
    } else if (notification.type === NotificationType.TENANT && notification.tenantId) {
      this.sseNotificationService.sendToTenant(notification.tenantId, {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        metadata: notification.metadata,
        actionData: notification.actionData,
      });
    } else if (notification.recipientId) {
      this.sseNotificationService.sendToUser(notification.recipientId, {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        metadata: notification.metadata,
        actionData: notification.actionData,
      });
    }
  }
  private async getRecipientEmail(recipientId: string): Promise<string | null> {
    try {
      return `user-${recipientId}@example.com`;
    } catch (error) {
      this.logger.error(`Failed to get recipient for ${recipientId}:`, error);
      return null;
    }
  }
}
