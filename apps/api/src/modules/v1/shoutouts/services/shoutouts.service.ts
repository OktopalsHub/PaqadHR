import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CelebrationType } from 'src/common/enums/celebration-type.enum';
import { PlatformIntegrationService } from 'src/common/integrations/services/platform-integration.service';
import { getPaginationSummary } from 'src/common/utils/pagination.util';
import { DataSource } from 'typeorm';
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
    readonly _platformIntegrationService: PlatformIntegrationService,
  ) {}

  async createShoutout(tenantId: string, senderMemberId: string, input: CreateShoutoutInput) {
    const settings = await this.tenantSettingsService.getTenantSettings(tenantId);
    const { points, shoutouts: shoutoutSettings } = settings.settings;

    // Merge duplicate mentions of the same recipient by summing their points,
    // preserving first-seen order.
    const mergedPoints = new Map<string, number>();
    for (const recipient of input.recipients ?? []) {
      if (!recipient?.recipientId || !Number.isFinite(recipient.points)) {
        throw new BadRequestException('Each recipient needs an id and a points amount');
      }
      mergedPoints.set(
        recipient.recipientId,
        (mergedPoints.get(recipient.recipientId) ?? 0) + Math.trunc(recipient.points),
      );
    }
    const recipients = [...mergedPoints.entries()].map(([recipientId, pts]) => ({
      recipientId,
      points: pts,
    }));
    const recipientIds = recipients.map((r) => r.recipientId);

    if (recipients.length === 0) {
      throw new BadRequestException('At least one recipient is required');
    }
    if (recipientIds.includes(senderMemberId)) {
      throw new BadRequestException('You cannot give a shoutout to yourself');
    }
    if (recipients.length > shoutoutSettings.maxRecipientsPerShoutout) {
      throw new BadRequestException(
        `Maximum ${shoutoutSettings.maxRecipientsPerShoutout} recipients per shoutout`,
      );
    }
    for (const recipient of recipients) {
      if (
        recipient.points < points.minPointsPerShoutout ||
        recipient.points > points.maxPointsPerShoutout
      ) {
        throw new BadRequestException(
          `Points for each recipient must be between ${points.minPointsPerShoutout} and ${points.maxPointsPerShoutout} Paq points`,
        );
      }
    }

    const validMembers = await this.tenantMembersService.filterTenantMemberIds(
      tenantId,
      recipientIds,
    );
    const invalid = recipientIds.filter((id) => !validMembers.has(id));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Recipient${invalid.length > 1 ? 's' : ''} ${invalid.join(', ')} ${invalid.length > 1 ? 'are' : 'is'} not a member of this tenant`,
      );
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

    const totalPoints = recipients.reduce((sum, r) => sum + r.points, 0);

    const shoutout = await this.dataSource.transaction(async (manager) => {
      const saved = await this.shoutoutsRepository.insertShoutout(manager, {
        tenantId,
        createdBy: senderMemberId,
        message: input.message,
        totalPoints,
        recipients,
        categoryIds,
      });

      await this.memberPointsService.applyShoutoutPoints(
        manager,
        tenantId,
        senderMemberId,
        recipients,
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
      senderUserId: full.creator?.userId ?? null,
      recipients,
      recipientIds,
      totalPoints,
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

  async createCelebrationShoutout(input: {
    tenantId: string;
    actorMemberId: string;
    recipientId: string;
    points: number;
    message: string;
    celebrationType: CelebrationType;
  }): Promise<boolean> {
    if (input.points <= 0) return false;

    const today = new Date().toISOString().slice(0, 10);
    const dedupKey = `celebration:${input.celebrationType}:${input.recipientId}:${today}`;

    const alreadyProcessed = await this.memberPointsService.hasCelebrationGrant(
      input.tenantId,
      input.recipientId,
      dedupKey,
    );
    if (alreadyProcessed) return false;

    const settings = await this.tenantSettingsService.getTenantSettings(input.tenantId);
    const shoutoutSettings = settings.settings.shoutouts;

    let categoryIds: string[] = [];
    if (shoutoutSettings.enableCategories) {
      const defaultId = await this.categoriesService.getDefaultCategoryId(input.tenantId);
      if (defaultId) categoryIds = [defaultId];
    }

    const shoutout = await this.dataSource.transaction(async (manager) => {
      const saved = await this.shoutoutsRepository.insertShoutout(manager, {
        tenantId: input.tenantId,
        createdBy: input.actorMemberId,
        message: input.message,
        totalPoints: input.points,
        recipients: [{ recipientId: input.recipientId, points: input.points }],
        categoryIds,
      });

      await this.memberPointsService.grantCelebrationPoints(
        manager,
        input.tenantId,
        input.recipientId,
        input.points,
        saved.id,
        dedupKey,
        input.actorMemberId,
      );

      return saved;
    });

    const full = await this.shoutoutsRepository.getById(input.tenantId, shoutout.id);
    if (!full) return true;

    const eventPayload: ShoutoutCreatedEventPayload = {
      tenantId: input.tenantId,
      shoutoutId: full.id,
      senderMemberId: input.actorMemberId,
      senderUserId: full.creator?.userId ?? null,
      recipients: [{ recipientId: input.recipientId, points: input.points }],
      recipientIds: [input.recipientId],
      totalPoints: input.points,
      message: full.message,
      categoryNames:
        (full.categoryAssignments?.map((a) => a.category?.name).filter(Boolean) as string[]) ?? [],
      source: 'celebration',
    };

    this.eventEmitter.emit(SHOUTOUT_CREATED_EVENT, eventPayload);
    this.dispatchNotifications(input.tenantId, full).catch((err) =>
      this.logger.error('Celebration shoutout notification dispatch failed', err),
    );

    return true;
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

    await Promise.all(
      shoutout.recipients.map((recipient) =>
        this.notificationHelper.sendShoutoutNotification(recipient.recipientId, tenantId, {
          senderName,
          message: shoutout.message,
          points: recipient.points,
        }),
      ),
    );
  }

  private formatMemberName(member?: {
    firstName?: string | null;
    lastName?: string | null;
    preferredName?: string | null;
  }): string {
    if (!member) return 'Someone';
    const parts = [member.firstName, member.lastName].filter(Boolean);
    if (parts.length > 0) return parts.join(' ');
    return member.preferredName || 'Someone';
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
