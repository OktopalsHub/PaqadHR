import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { formatMemberDisplayName } from '../../../../common/utils/member-display.util';
import { ActivitiesService } from '../../activities/services/activities.service';
import type { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import {
  SHOUTOUT_CREATED_EVENT,
  type ShoutoutCreatedEventPayload,
} from '../events/shoutout.events';
import { ShoutoutAuditService } from '../services/shoutout-audit.service';

@Injectable()
export class ShoutoutAuditListener {
  private readonly logger = new Logger(ShoutoutAuditListener.name);

  constructor(
    private readonly shoutoutAuditService: ShoutoutAuditService,
    private readonly activitiesService: ActivitiesService,
    private readonly tenantMembersService: TenantMembersService,
  ) {}

  @OnEvent(SHOUTOUT_CREATED_EVENT)
  async handleShoutoutCreated(payload: ShoutoutCreatedEventPayload): Promise<void> {
    await this.shoutoutAuditService.logShoutoutCreated(payload);

    // Fetch recipient names for the activity description; fall back to count on failure.
    let recipientMembers: TenantMember[] = [];
    try {
      recipientMembers = await this.tenantMembersService.getTenantMembersByIds(
        payload.tenantId,
        payload.recipientIds,
      );
    } catch (error) {
      this.logger.error(
        `Shoutout recipient lookup failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const recipientNames = recipientMembers
      .map((member) => formatMemberDisplayName(member))
      .filter((name): name is string => name !== null)
      .join(', ');

    const recipientCount = payload.recipientIds.length;
    const description =
      recipientNames.length > 0
        ? `Gave a shoutout to ${recipientNames} (${payload.totalPoints} points)`
        : `Gave a shoutout to ${recipientCount} recipient(s) (${payload.totalPoints} points)`;

    await this.activitiesService.queueActivity({
      tenantId: payload.tenantId,
      actorMemberId: payload.senderMemberId,
      action: 'shoutout.created',
      resourceType: 'shoutout',
      resourceId: payload.shoutoutId,
      description,
      metadata: {
        recipientCount,
        totalPoints: payload.totalPoints,
        categoryNames: payload.categoryNames,
        source: payload.source,
      },
    });
  }
}
