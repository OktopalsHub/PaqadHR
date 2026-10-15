import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantRoleGuard } from '../../../common/guards/tenant-member-role.guard';
import { ActivitiesModule } from '../activities/activities.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { NotificationController } from './controllers/notification.controller';
import { NotificationPreferenceController } from './controllers/notification-preference.controller';
import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationEventListener } from './listeners/notification-event.listener';
import { EmailTemplateService } from './services/email-template.service';
import { EngagementNotificationsService } from './services/engagement-notifications.service';
import { LeaveNotificationsService } from './services/leave-notifications.service';
import { MemberNotificationsService } from './services/member-notifications.service';
import { NotificationService } from './services/notification.service';
import { NotificationDeliveryService } from './services/notification-delivery.service';
import { NotificationHelperService } from './services/notification-helper.service';
import { NotificationPreferenceService } from './services/notification-preference.service';
import { PayrollNotificationsService } from './services/payroll-notifications.service';
import { SSENotificationService } from './services/sse-notification.service';
import { SystemNotificationsService } from './services/system-notifications.service';
import { ZeptomailEmailService } from './services/zeptomail-email.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationPreference]),
    TenantMembersModule,
    ActivitiesModule,
  ],
  controllers: [NotificationController, NotificationPreferenceController],
  providers: [
    EmailTemplateService,
    NotificationService,
    NotificationDeliveryService,
    NotificationPreferenceService,
    ZeptomailEmailService,
    SSENotificationService,
    NotificationHelperService,
    MemberNotificationsService,
    PayrollNotificationsService,
    LeaveNotificationsService,
    EngagementNotificationsService,
    SystemNotificationsService,
    NotificationEventListener,
    TenantRoleGuard,
  ],
  exports: [
    EmailTemplateService,
    NotificationService,
    NotificationDeliveryService,
    NotificationPreferenceService,
    ZeptomailEmailService,
    SSENotificationService,
    NotificationHelperService,
    MemberNotificationsService,
    PayrollNotificationsService,
    LeaveNotificationsService,
    EngagementNotificationsService,
    SystemNotificationsService,
  ],
})
export class NotificationsModule {}
