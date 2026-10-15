import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
import { NotificationDeliveryService } from './notification-delivery.service';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationPreference)
    _preferenceRepository: Repository<NotificationPreference>,
    private tenantMembersService: TenantMembersService,
    private readonly activitiesService: ActivitiesService,
    private readonly deliveryService: NotificationDeliveryService,
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
    await this.deliveryService.deliver(this.notificationRepository, notification);
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
