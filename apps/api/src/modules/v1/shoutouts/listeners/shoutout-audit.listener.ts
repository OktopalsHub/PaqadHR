import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ActivitiesService } from '../../activities/services/activities.service';
import {
  SHOUTOUT_CREATED_EVENT,
  type ShoutoutCreatedEventPayload,
} from '../events/shoutout.events';
import { ShoutoutAuditService } from '../services/shoutout-audit.service';

@Injectable()
export class ShoutoutAuditListener {
  constructor(
    private readonly shoutoutAuditService: ShoutoutAuditService,
    private readonly activitiesService: ActivitiesService,
  ) {}

  @OnEvent(SHOUTOUT_CREATED_EVENT)
  async handleShoutoutCreated(payload: ShoutoutCreatedEventPayload): Promise<void> {
    await this.shoutoutAuditService.logShoutoutCreated(payload);

    const recipientCount = payload.recipientIds.length;
    await this.activitiesService.queueActivity({
      tenantId: payload.tenantId,
      actorMemberId: payload.senderMemberId,
      action: 'shoutout.created',
      resourceType: 'shoutout',
      resourceId: payload.shoutoutId,
      description: `Gave a shoutout to ${recipientCount} recipient(s) (${payload.totalPoints} points)`,
      metadata: {
        recipientCount,
        totalPoints: payload.totalPoints,
        categoryNames: payload.categoryNames,
        source: payload.source,
      },
    });
  }
}
