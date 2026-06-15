import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationService } from './services/notification.service';
import { NotificationPreferenceService } from './services/notification-preference.service';
import { ZeptomailEmailService } from './services/zeptomail-email.service';
import { SSENotificationService } from './services/sse-notification.service';
import { NotificationHelperService } from './services/notification-helper.service';
import { NotificationPreference } from "./entities/notification-preference.entity";
import { NotificationController } from "./controllers/notification.controller";
import { NotificationPreferenceController } from "./controllers/notification-preference.controller";
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { Notification } from './entities/notification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationPreference]),
    TenantMembersModule,
  ],
  controllers: [NotificationController, NotificationPreferenceController],
  providers: [
    NotificationService,
    NotificationPreferenceService,
    ZeptomailEmailService,
    SSENotificationService,
    NotificationHelperService,
  ],
  exports: [
    NotificationService,
    NotificationPreferenceService,
    ZeptomailEmailService,
    SSENotificationService,
    NotificationHelperService,
  ],
})
export class NotificationsModule {}
