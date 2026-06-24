import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { runCronJob } from 'src/common/utils/cron-logging.util';
import { CalendarEventReminderService } from './calendar-event-reminder.service';

@Injectable()
export class CalendarEventReminderCronService {
  private readonly logger = new Logger(CalendarEventReminderCronService.name);

  constructor(private readonly reminderService: CalendarEventReminderService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processDueReminders(): Promise<void> {
    await runCronJob(this.logger, 'calendar-event-reminders', async () => {
      return this.reminderService.processDueReminders();
    });
  }
}
