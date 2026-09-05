import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitiesModule } from '../activities/activities.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantConfigModule } from '../tenant-settings/tenant-config.module';
import { TenantsModule } from '../tenants/tenants.module';
import { CalendarEventsController } from './calendar-events.controller';
import { CalendarEventsService } from './calendar-events.service';
import { TenantCalendarEvent } from './entities/tenant-calendar-event.entity';
import { CalendarEventReminderService } from './services/calendar-event-reminder.service';
import { CalendarEventReminderCronService } from './services/calendar-event-reminder-cron.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TenantCalendarEvent]),
    TenantMembersModule,
    TenantConfigModule,
    TenantsModule,
    NotificationsModule,
    ActivitiesModule,
  ],
  controllers: [CalendarEventsController],
  providers: [
    CalendarEventsService,
    CalendarEventReminderService,
    CalendarEventReminderCronService,
  ],
  exports: [CalendarEventsService],
})
export class CalendarEventsModule {}
