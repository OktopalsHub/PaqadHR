import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { getPaginationSummary } from 'src/common/utils/pagination.util';
import type { DataSource } from 'typeorm';
import { NotificationHelperService } from '../../notifications/services/notification-helper.service';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import {
  SHOUTOUT_CREATED_EVENT,
  type ShoutoutCreatedEventPayload,
} from '../events/shoutout.events';
import type { CreateShoutoutInput } from '../interfaces/shoutout.interface';
import type { ShoutoutFilters } from '../interfaces/shoutout-filters.interface';
import { ShoutoutsRepository } from '../repositories/shoutouts.repository';
import { MemberPointsService } from './member-points.service';
import { ShoutoutCategoriesService } from './shoutout-categories.service';

@Injectable()
export class ShoutoutsService {
  private readonly logger = new Logger(ShoutoutsService.name);

  constructor(
    private readonly shoutoutsRepository: ShoutoutsRepository,
    private readonly memberPointsService: MemberPointsService,
    private readonly categoriesService: ShoutoutCategoriesService,
    private readonly tenantSettingsService: TenantSettingsService,
    private readonly tenantMembersService: TenantMembersService,
    private readonly notificationHelper: NotificationHelperService,
    private readonly eventEmitter: EventEmitter2,
    private readonly dataSource: DataSource,
  ) {}

  async createShoutout(tenantId: string, senderMemberId: string, input: CreateShoutoutInput) {
    const settings = await this.tenantSettingsService.getTenantSettings(tenantId);
    const { points, shoutouts: shoutoutSettings } = settings.settings;

    const recipientIds = [...new Set(input.recipientIds)];
    if (recipientIds.length === 0) {
      throw new BadRequestException('At least one recipient is required');
    }
    if (recipientIds.includes(senderMemberId)) {
      throw new BadRequestException('You cannot give a shoutout to yourself');
    }
    if (recipientIds.length > shoutoutSettings.maxRecipientsPerShoutout) {
      throw new BadRequestException(
        `Maximum ${shoutoutSettings.maxRecipientsPerShoutout} recipients per shoutout`,
      );
    }
    if (
      input.pointsPerRecipient < points.minPointsPerShoutout ||
      input.pointsPerRecipient > points.maxPointsPerShoutout
    ) {
      throw new BadRequestException(
        `Points must be between ${points.minPointsPerShoutout} and ${points.maxPointsPerShoutout}`,
      );
    }

    for (const recipientId of recipientIds) {
      try {
        await this.tenantMembersService.getTenantMemberId(tenantId, recipientId);
      } catch {
        throw new BadRequestException(`Recipient ${recipientId} is not a member of this tenant`);
      }
    }

    let categoryIds = input.categoryIds ?? [];
    if (shoutoutSettings.enableCategories && categoryIds.length === 0) {
      const defaultId = await this.categoriesService.getDefaultCategoryId(tenantId);
      if (!defaultId) {
        throw new BadRequestException(
          'No active categories configured. Please create a category first.',
        );
      }
      categoryIds = [defaultId];
    }
    categoryIds = await this.categoriesService.resolveCategoryIds(
      tenantId,
      categoryIds,
      shoutoutSettings.enableCategories,
    );

    const totalPoints = input.pointsPerRecipient * recipientIds.length;

    const shoutout = await this.dataSource.transaction(async (manager) => {
      await this.memberPointsService.validateSenderAllowance(
        tenantId,
        senderMemberId,
        totalPoints,
        manager,
      );

      const saved = await this.shoutoutsRepository.insertShoutout(manager, {
        tenantId,
        createdBy: senderMemberId,
        message: input.message,
        totalPoints,
        recipientIds,
        pointsPerRecipient: input.pointsPerRecipient,
        categoryIds,
      });

      await this.memberPointsService.applyShoutoutPoints(
        manager,
        tenantId,
        senderMemberId,
        recipientIds,
        input.pointsPerRecipient,
        saved.id,
      );

      return saved;
    });

    const full = await this.shoutoutsRepository.getById(tenantId, shoutout.id);
    if (!full) {
      throw new BadRequestException('Failed to load created shoutout');
    }

    const eventPayload: ShoutoutCreatedEventPayload = {
      tenantId,
      shoutoutId: full.id,
      senderMemberId,
      recipientIds,
      totalPoints,
      pointsPerRecipient: input.pointsPerRecipient,
      message: full.message,
      categoryNames:
        (full.categoryAssignments?.map((a) => a.category?.name).filter(Boolean) as string[]) ?? [],
      source: input.source ?? 'api',
    };

    this.eventEmitter.emit(SHOUTOUT_CREATED_EVENT, eventPayload);
    this.dispatchNotifications(tenantId, full).catch((err) =>
      this.logger.error('Shoutout notification dispatch failed', err),
    );

    return this.toShoutoutResponse(full);
  }

  async listShoutouts(tenantId: string, filters: ShoutoutFilters) {
    const { records, total } = await this.shoutoutsRepository.listPaginated(tenantId, filters);
    const mapped = records.map((s) => this.toShoutoutResponse(s));
    return getPaginationSummary(
      mapped,
      total,
      { page: filters.page, limit: filters.limit },
      'shoutouts',
    );
  }

  private async dispatchNotifications(
    tenantId: string,
    shoutout: NonNullable<Awaited<ReturnType<ShoutoutsRepository['getById']>>>,
  ) {
    if (!shoutout) return;

    const senderName = this.formatMemberName(shoutout.creator);

    for (const recipient of shoutout.recipients) {
      await this.notificationHelper.sendShoutoutNotification(recipient.recipientId, tenantId, {
        senderName,
        message: shoutout.message,
        points: recipient.points,
      });
    }
  }

  private formatMemberName(member?: {
    firstName?: string | null;
    lastName?: string | null;
    preferredName?: string | null;
  }): string {
    if (!member) return 'Someone';
    if (member.preferredName) return member.preferredName;
    const parts = [member.firstName, member.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'Someone';
  }

  private toShoutoutResponse(
    shoutout: NonNullable<Awaited<ReturnType<ShoutoutsRepository['getById']>>>,
  ) {
    return {
      id: shoutout.id,
      tenantId: shoutout.tenantId,
      message: shoutout.message,
      totalPoints: shoutout.totalPoints,
      createdAt: shoutout.createdAt,
      sender: {
        id: shoutout.createdBy,
        firstName: shoutout.creator?.firstName ?? null,
        lastName: shoutout.creator?.lastName ?? null,
        preferredName: shoutout.creator?.preferredName ?? null,
      },
      recipients: shoutout.recipients.map((r) => ({
        id: r.recipientId,
        points: r.points,
        firstName: r.recipient?.firstName ?? null,
        lastName: r.recipient?.lastName ?? null,
        preferredName: r.recipient?.preferredName ?? null,
      })),
      categories: shoutout.categoryAssignments.map((a) => ({
        id: a.categoryId,
        name: a.category?.name ?? null,
        color: a.category?.color ?? null,
      })),
    };
  }
}
