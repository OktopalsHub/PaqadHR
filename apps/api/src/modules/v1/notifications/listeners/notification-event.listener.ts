import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ProfileUpdatedEvent } from '../../leave/events/leave.events';
import { NotificationHelperService } from '../services/notification-helper.service';

@Injectable()
export class NotificationEventListener {
  private readonly logger = new Logger(NotificationEventListener.name);

  constructor(private readonly notificationHelperService: NotificationHelperService) {}

  @OnEvent('profile.updated')
  async handleProfileUpdated(event: ProfileUpdatedEvent): Promise<void> {
    try {
      await this.notificationHelperService.sendProfileUpdatedNotification(
        event.recipientId,
        event.tenantId,
        event.variables,
      );
    } catch (error) {
      this.logger.error('Failed to send profile updated notification', error);
    }
  }
}
