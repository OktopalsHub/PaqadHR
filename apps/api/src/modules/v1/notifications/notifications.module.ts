import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitiesModule } from '../activities/activities.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { NotificationController } from './controllers/notification.controller';
import { NotificationPreferenceController } from './controllers/notification-preference.controller';
import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { EmailTemplateService } from './services/email-template.service';
import { NotificationService } from './services/notification.service';
import { NotificationHelperService } from './services/notification-helper.service';
import { NotificationPreferenceService } from './services/notification-preference.service';
import { SSENotificationService } from './services/sse-notification.service';
import { ZeptomailEmailService } from './services/zeptomail-email.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationPreference]),
    forwardRef(() => TenantMembersModule),
    forwardRef(() => ActivitiesModule),
  ],
  controllers: [NotificationController, NotificationPreferenceController],
  providers: [
    EmailTemplateService,
    NotificationService,
    NotificationPreferenceService,
    ZeptomailEmailService,
    SSENotificationService,
    NotificationHelperService,
  ],
  exports: [
    EmailTemplateService,
    NotificationService,
    NotificationPreferenceService,
    ZeptomailEmailService,
    SSENotificationService,
    NotificationHelperService,
  ],
})
export class NotificationsModule {}
