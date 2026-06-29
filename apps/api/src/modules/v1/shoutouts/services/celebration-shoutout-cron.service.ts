import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { runCronJob } from 'src/common/utils/cron-logging.util';
import { CelebrationShoutoutService } from './celebration-shoutout.service';

@Injectable()
export class CelebrationShoutoutCronService {
  private readonly logger = new Logger(CelebrationShoutoutCronService.name);

  constructor(private readonly celebrationShoutoutService: CelebrationShoutoutService) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async processDailyCelebrations(): Promise<void> {
    await runCronJob(this.logger, 'celebration-shoutouts', async () => {
      return this.celebrationShoutoutService.processDailyCelebrations();
    });
  }
}
