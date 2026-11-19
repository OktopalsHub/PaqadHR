import { Module } from '@nestjs/common';

import { CronClaimService } from '../services/cron-claim.service';

@Module({
  providers: [CronClaimService],
  exports: [CronClaimService],
})
export class CronClaimModule {}
