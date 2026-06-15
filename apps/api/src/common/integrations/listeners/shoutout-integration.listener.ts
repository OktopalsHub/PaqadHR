import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  SHOUTOUT_CREATED_EVENT,
  type ShoutoutCreatedEventPayload,
} from '../../../modules/v1/shoutouts/events/shoutout.events';
import { PlatformIntegrationService } from '../services/platform-integration.service';

@Injectable()
export class ShoutoutIntegrationListener {
  private readonly logger = new Logger(ShoutoutIntegrationListener.name);

  constructor(private readonly platformIntegrationService: PlatformIntegrationService) {}

  @OnEvent(SHOUTOUT_CREATED_EVENT)
  async handleShoutoutCreated(payload: ShoutoutCreatedEventPayload): Promise<void> {
    try {
      await this.platformIntegrationService.broadcastShoutout(payload.tenantId, {
        message: payload.message,
        total_points: payload.totalPoints,
        creator: { tenantMemberId: payload.senderMemberId },
        recipients: payload.recipientIds.map((recipientId) => ({
          tenantMemberId: recipientId,
          points: payload.pointsPerRecipient,
        })),
        categories: payload.categoryNames,
      });
    } catch (error) {
      this.logger.error(
        `Failed to broadcast shoutout ${payload.shoutoutId} to integrations`,
        error,
      );
    }
  }
}
