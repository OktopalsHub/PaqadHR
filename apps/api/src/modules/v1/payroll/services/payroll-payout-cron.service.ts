import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { runCronJob } from 'src/common/utils/cron-logging.util';
import { isPayrollGatewayEnabled } from '../config/payroll-disbursement.config';
import { PayrollService } from './payroll.service';
import { PayrollPayoutService } from './payroll-payout.service';

@Injectable()
export class PayrollPayoutCronService {
  private readonly logger = new Logger(PayrollPayoutCronService.name);

  constructor(
    private readonly payrollPayoutService: PayrollPayoutService,
    private readonly payrollService: PayrollService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async requeryStuckPayouts(): Promise<void> {
    if (!isPayrollGatewayEnabled()) {
      return;
    }

    await runCronJob(this.logger, 'payroll-payout-requery', async () => {
      return this.payrollPayoutService.requeryStuckPayouts();
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async processScheduledPayouts(): Promise<void> {
    if (!isPayrollGatewayEnabled()) {
      return;
    }

    await runCronJob(this.logger, 'payroll-scheduled-payouts', async () => {
      return this.payrollService.processDueScheduledPayouts();
    });
  }
}
