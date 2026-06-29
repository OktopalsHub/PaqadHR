import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { runCronJob } from 'src/common/utils/cron-logging.util';
import { isPayrollGatewayEnabled } from '../config/payroll-disbursement.config';
import { PayrollPayoutService } from './payroll-payout.service';

@Injectable()
export class PayrollPayoutCronService {
  private readonly logger = new Logger(PayrollPayoutCronService.name);

  constructor(private readonly payrollPayoutService: PayrollPayoutService) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async requeryStuckPayouts(): Promise<void> {
    if (!isPayrollGatewayEnabled()) {
      return;
    }

    await runCronJob(this.logger, 'payroll-payout-requery', async () => {
      return this.payrollPayoutService.requeryStuckPayouts();
    });
  }
}
